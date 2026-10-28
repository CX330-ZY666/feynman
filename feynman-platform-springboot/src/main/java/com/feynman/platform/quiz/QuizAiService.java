package com.feynman.platform.quiz;

import com.fasterxml.jackson.databind.JsonNode;
import com.feynman.platform.common.ApiException;
import com.feynman.platform.knowledge.KnowledgePointEntity;
import com.feynman.platform.knowledge.KnowledgePointMapper;
import com.feynman.platform.practice.DeepSeekClient;
import com.feynman.platform.rag.RagDeepSeekClient;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class QuizAiService {
    private final RagDeepSeekClient aiClient;
    private final DeepSeekClient jsonParser;
    private final KnowledgePointMapper knowledgePointMapper;

    public QuizAiService(
            RagDeepSeekClient aiClient,
            DeepSeekClient jsonParser,
            KnowledgePointMapper knowledgePointMapper
    ) {
        this.aiClient = aiClient;
        this.jsonParser = jsonParser;
        this.knowledgePointMapper = knowledgePointMapper;
    }

    public Map<String, Object> generate(GenerateQuestionRequest request) {
        boolean choice = "single-choice".equals(request.effectiveType());
        String format = choice
                ? "{\"question\":\"题目\",\"options\":{\"A\":\"选项\",\"B\":\"选项\",\"C\":\"选项\",\"D\":\"选项\"},\"answer\":\"A\",\"explanation\":\"解析\"}"
                : "{\"question\":\"开放题目\",\"answer_key_points\":[\"要点1\",\"要点2\",\"要点3\"],\"reference_answer\":\"参考答案\"}";
        String prompt = """
                你是专业教师。请严格根据知识点内容生成一道%s，难度为“%s”。
                不要考查资料中没有出现的事实，不要重复原文句子作为答案提示。
                严格只输出 JSON，不要使用 Markdown：%s

                【知识点内容】
                %s
                """.formatted(choice ? "单选题" : "简答题", request.difficulty(), format, request.knowledgePointContent());
        JsonNode json = jsonParser.parseJson(aiClient.answer(prompt));
        return choice ? validateChoiceQuestion(json) : validateShortQuestion(json);
    }

    public ChoiceExplanationResponse explain(ExplainChoiceRequest request) {
        requireFourOptions(request.options());
        boolean correct = request.correctAnswer().equals(request.userAnswer());
        String prompt = """
                你是专业教师，请解析下面的选择题。只输出 JSON：
                {"correctExplanation":"为什么正确答案正确","wrongExplanation":"学生答案或其他选项的问题","knowledgePoints":"本题核心知识总结"}

                题目：%s
                A. %s
                B. %s
                C. %s
                D. %s
                正确答案：%s
                学生答案：%s
                原始解析：%s
                """.formatted(
                request.question(), request.options().get("A"), request.options().get("B"),
                request.options().get("C"), request.options().get("D"), request.correctAnswer(),
                request.userAnswer(), value(request.originalExplanation()));
        JsonNode json = jsonParser.parseJson(aiClient.answer(prompt));
        return new ChoiceExplanationResponse(
                correct, request.userAnswer(), request.correctAnswer(),
                requiredText(json, "correctExplanation"),
                requiredText(json, "wrongExplanation"),
                requiredText(json, "knowledgePoints")
        );
    }

    public GradeAnswerResponse grade(String userId, GradeAnswerRequest request) {
        requireOwnedPointWhenPresent(userId, request.knowledgePointId());
        String numberedPoints = java.util.stream.IntStream.range(0, request.answerKeyPoints().size())
                .mapToObj(index -> (index + 1) + ". " + request.answerKeyPoints().get(index))
                .reduce((left, right) -> left + "\n" + right).orElse("");
        String prompt = """
                你是严格而友好的评分教师。根据标准要点评估学生简答题。
                只输出 JSON：
                {"score":0到100整数,"isCorrect":true,"analysis":"覆盖与缺失分析","suggestions":"改进建议","standardAnswer":"完整参考答案"}
                isCorrect 必须等于 score >= 60。

                【题目】%s
                【标准要点】
                %s
                【学生答案】
                %s
                """.formatted(request.question(), numberedPoints, request.studentAnswer());
        JsonNode json = jsonParser.parseJson(aiClient.answer(prompt));
        if (!json.path("score").isNumber()) invalidResponse();
        int score = Math.max(0, Math.min(100, (int) Math.round(json.path("score").doubleValue())));
        return new GradeAnswerResponse(
                score, score >= 60,
                requiredText(json, "analysis"),
                requiredText(json, "suggestions"),
                requiredText(json, "standardAnswer")
        );
    }

    private Map<String, Object> validateChoiceQuestion(JsonNode json) {
        String question = requiredText(json, "question");
        String answer = requiredText(json, "answer");
        if (!List.of("A", "B", "C", "D").contains(answer)) invalidResponse();
        JsonNode options = json.path("options");
        if (!options.isObject()) invalidResponse();
        Map<String, String> optionMap = new LinkedHashMap<>();
        for (String key : List.of("A", "B", "C", "D")) optionMap.put(key, requiredText(options, key));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("question", question);
        result.put("options", optionMap);
        result.put("answer", answer);
        result.put("explanation", requiredText(json, "explanation"));
        return result;
    }

    private Map<String, Object> validateShortQuestion(JsonNode json) {
        JsonNode points = json.path("answer_key_points");
        if (!points.isArray() || points.isEmpty()) invalidResponse();
        List<String> keyPoints = new java.util.ArrayList<>();
        points.forEach(point -> { if (point.isTextual() && !point.asText().isBlank()) keyPoints.add(point.asText().trim()); });
        if (keyPoints.isEmpty()) invalidResponse();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("question", requiredText(json, "question"));
        result.put("answer_key_points", keyPoints);
        result.put("reference_answer", requiredText(json, "reference_answer"));
        return result;
    }

    private void requireFourOptions(Map<String, String> options) {
        if (!options.keySet().containsAll(List.of("A", "B", "C", "D"))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OPTIONS_INCOMPLETE", "Options must contain A, B, C, and D");
        }
    }

    private void requireOwnedPointWhenPresent(String userId, String pointId) {
        if (pointId == null) return;
        KnowledgePointEntity point = knowledgePointMapper.selectById(pointId);
        if (point == null) throw new ApiException(HttpStatus.NOT_FOUND, "KNOWLEDGE_POINT_NOT_FOUND", "Knowledge point not found");
        if (!userId.equals(point.getAuthorId())) throw new ApiException(HttpStatus.FORBIDDEN, "NOT_AUTHORIZED", "Not authorized");
    }

    private String requiredText(JsonNode json, String field) {
        String value = json.path(field).asText("").trim();
        if (value.isEmpty()) invalidResponse();
        return value;
    }

    private String value(String value) {
        return value == null ? "无" : value;
    }

    private void invalidResponse() {
        throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_INVALID_RESPONSE", "AI 返回格式不完整");
    }
}
