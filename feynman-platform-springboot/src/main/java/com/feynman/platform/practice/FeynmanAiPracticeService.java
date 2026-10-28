package com.feynman.platform.practice;

import com.fasterxml.jackson.databind.JsonNode;
import com.feynman.platform.common.ApiException;
import com.feynman.platform.knowledge.KnowledgePointEntity;
import com.feynman.platform.knowledge.KnowledgePointMapper;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class FeynmanAiPracticeService {
    private final KnowledgePointMapper knowledgePointMapper;
    private final DeepSeekClient deepSeekClient;

    public FeynmanAiPracticeService(KnowledgePointMapper knowledgePointMapper, DeepSeekClient deepSeekClient) {
        this.knowledgePointMapper = knowledgePointMapper;
        this.deepSeekClient = deepSeekClient;
    }

    public AskQuestionResponse ask(String userId, AskQuestionRequest request) {
        KnowledgePointEntity point = requireOwnedPoint(userId, request.knowledgePointId());
        if (!deepSeekClient.isConfigured()) {
            return new AskQuestionResponse(
                    "嗯，我还没有完全听懂“" + point.getTitle() + "”。你能用更简单的话解释，并举一个生活中的例子吗？",
                    true,
                    "当前为未配置 DeepSeek 密钥的开发模式",
                    "mock"
            );
        }
        String raw = deepSeekClient.chat(buildAskPrompt(point, request), 0.7, 300);
        JsonNode json = deepSeekClient.parseJson(raw);
        String question = requiredText(json, "question");
        boolean shouldContinue = json.path("shouldContinue").isBoolean()
                ? json.path("shouldContinue").booleanValue() : true;
        String reason = json.path("reason").asText("");
        return new AskQuestionResponse(question.trim(), shouldContinue, reason, "deepseek");
    }

    public UnderstandingEvaluationResponse evaluate(String userId, EvaluateUnderstandingRequest request) {
        KnowledgePointEntity point = requireOwnedPoint(userId, request.knowledgePointId());
        String explanations = request.conversationHistory().stream()
                .filter(message -> "user".equals(message.role()))
                .map(ConversationMessage::content)
                .reduce((left, right) -> left + "\n\n" + right)
                .orElse("").trim();
        if (explanations.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "USER_EXPLANATION_REQUIRED", "没有用户讲解内容");
        }
        if (!deepSeekClient.isConfigured()) {
            return new UnderstandingEvaluationResponse(
                    75, false,
                    List.of("能用自己的话表达", "已经主动参与讲解"),
                    List.of("可以更深入解释原理"),
                    "你已经能够表达这个知识点的主要内容。建议再补充一个实际例子，并说明它为什么有效。"
            );
        }
        String raw = deepSeekClient.chat(buildEvaluationPrompt(point, explanations), 0.3, 500);
        JsonNode json = deepSeekClient.parseJson(raw);
        if (!json.path("understandingScore").isNumber() || !json.path("isParroting").isBoolean()) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_INVALID_RESPONSE", "AI 评估结果格式不完整");
        }
        int score = Math.max(0, Math.min(100, json.path("understandingScore").intValue()));
        return new UnderstandingEvaluationResponse(
                score,
                json.path("isParroting").booleanValue(),
                stringList(json.path("strengths")),
                stringList(json.path("weaknesses")),
                requiredText(json, "feedback")
        );
    }

    private KnowledgePointEntity requireOwnedPoint(String userId, String id) {
        KnowledgePointEntity point = knowledgePointMapper.selectById(id);
        if (point == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "KNOWLEDGE_POINT_NOT_FOUND", "Knowledge point not found");
        }
        if (!userId.equals(point.getAuthorId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_AUTHORIZED", "Not authorized");
        }
        return point;
    }

    private String buildAskPrompt(KnowledgePointEntity point, AskQuestionRequest request) {
        List<ConversationMessage> history = request.conversationHistory() == null
                ? List.of() : request.conversationHistory();
        StringBuilder historyText = new StringBuilder();
        for (ConversationMessage message : history) {
            historyText.append("user".equals(message.role()) ? "用户: " : "AI学生: ")
                    .append(message.content()).append('\n');
        }
        long userTurns = history.stream().filter(message -> "user".equals(message.role())).count() + 1;
        return """
                你是一个完全不懂技术、友好而好奇的小白学生“小问”。用户正在用费曼学习法向你讲解概念。
                只能根据用户实际说过的内容提问，不能假设用户讲过未出现的术语。

                【知识点标题】%s
                【知识点参考】%s
                【之前的对话】
                %s
                【用户最新讲解】%s
                【当前轮次】第 %d 轮

                如果讲解不完整，请针对定义、原因、例子或边界提出一个自然的问题。
                只有当用户已讲清定义、原理、例子，并回答过追问且至少完成4轮时，shouldContinue 才为 false。
                严格输出 JSON：{"shouldContinue":true,"question":"50到150字的自然回复","reason":"判断原因"}
                """.formatted(point.getTitle(), shorten(point.getContent(), 500), historyText, request.userExplanation(), userTurns);
    }

    private String buildEvaluationPrompt(KnowledgePointEntity point, String explanations) {
        return """
                你是专业的学习评估老师。判断学生是真正理解，还是机械复述。
                【知识点标题】%s
                【知识点原文】%s
                【学生讲解】%s

                从理解深度、能否用自己的话解释、是否有例子、能否说明原因进行评估。
                严格输出 JSON：
                {"understandingScore":0到100的整数,"isParroting":false,"strengths":["优点"],"weaknesses":["待改进"],"feedback":"100到200字反馈"}
                """.formatted(point.getTitle(), shorten(point.getContent(), 1000), explanations);
    }

    private String requiredText(JsonNode json, String field) {
        String value = json.path(field).asText("").trim();
        if (value.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_INVALID_RESPONSE", "AI 返回格式不完整");
        }
        return value;
    }

    private List<String> stringList(JsonNode node) {
        if (!node.isArray()) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_INVALID_RESPONSE", "AI 返回格式不完整");
        }
        List<String> values = new ArrayList<>();
        node.forEach(item -> {
            if (item.isTextual() && !item.asText().isBlank()) values.add(item.asText().trim());
        });
        return values;
    }

    private String shorten(String value, int maxLength) {
        value = com.feynman.platform.common.LearningText.plain(value);
        if (value == null || value.isBlank()) return "无";
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
