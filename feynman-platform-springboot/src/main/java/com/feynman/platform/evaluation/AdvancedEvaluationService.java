package com.feynman.platform.evaluation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.feynman.platform.attempt.AttemptResponse;
import com.feynman.platform.attempt.FeynmanAttemptEntity;
import com.feynman.platform.attempt.FeynmanAttemptMapper;
import com.feynman.platform.common.ApiException;
import com.feynman.platform.knowledge.KnowledgePointEntity;
import com.feynman.platform.knowledge.KnowledgePointMapper;
import com.feynman.platform.practice.DeepSeekClient;
import com.feynman.platform.rag.RagDeepSeekClient;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class AdvancedEvaluationService {
    private final KnowledgePointMapper pointMapper;
    private final FeynmanAttemptMapper attemptMapper;
    private final RagDeepSeekClient aiClient;
    private final DeepSeekClient jsonParser;

    public AdvancedEvaluationService(
            KnowledgePointMapper pointMapper,
            FeynmanAttemptMapper attemptMapper,
            RagDeepSeekClient aiClient,
            DeepSeekClient jsonParser
    ) {
        this.pointMapper = pointMapper;
        this.attemptMapper = attemptMapper;
        this.aiClient = aiClient;
        this.jsonParser = jsonParser;
    }

    public Map<String, Object> evaluate(String userId, EvaluateStagedRequest request) {
        String original = request.originalContent();
        if (request.knowledgePointId() != null) {
            original = requireOwnedPoint(userId, request.knowledgePointId()).getContent();
        }
        original = com.feynman.platform.common.LearningText.plain(original);
        if (original == null || original.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ORIGINAL_CONTENT_REQUIRED", "originalContent is required");
        }
        String prompt = """
                你是费曼学习法评估专家。比较原始知识与学生复述，一次完成概念覆盖、逻辑结构和误区诊断。
                严格只输出 JSON：
                {"stage1":{"coveredConcepts":["概念"],"missedConcepts":["遗漏"]},"stage2":{"logicScore":0到100整数,"logicIssues":["问题"]},"stage3":{"misconceptions":[{"point":"误区","correction":"纠正"}],"strengths":["优点"],"suggestions":["建议"]}}

                【原始知识】%s
                【学生复述】%s
                """.formatted(original, request.transcribedText());
        JsonNode json = jsonParser.parseJson(aiClient.answer(prompt));
        JsonNode stage1 = object(json, "stage1");
        JsonNode stage2 = object(json, "stage2");
        JsonNode stage3 = object(json, "stage3");
        List<String> covered = strings(stage1, "coveredConcepts");
        List<String> missed = strings(stage1, "missedConcepts");
        int logic = boundedScore(stage2, "logicScore");
        List<Map<String, String>> misconceptions = misconceptions(stage3.path("misconceptions"));
        int totalConcepts = covered.size() + missed.size();
        int coverage = totalConcepts == 0 ? 0 : (int) Math.round(covered.size() * 100.0 / totalConcepts);
        int accuracy = misconceptions.isEmpty() ? 100 : 60;
        int finalScore = (int) Math.round(coverage * 0.4 + logic * 0.4 + accuracy * 0.2);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("stage1", Map.of("coveredConcepts", covered, "missedConcepts", missed, "name", "概念提取"));
        result.put("stage2", Map.of("logicScore", logic, "logicIssues", strings(stage2, "logicIssues"), "name", "逻辑结构"));
        result.put("stage3", Map.of("misconceptions", misconceptions, "strengths", strings(stage3, "strengths"), "suggestions", strings(stage3, "suggestions"), "name", "误区诊断"));
        result.put("finalScore", finalScore);
        result.put("breakdown", Map.of("coverage", coverage, "logic", logic, "accuracy", accuracy));
        return result;
    }

    public JsonNode followUp(FollowUpQuestionsRequest request) {
        String prompt = """
                根据评估结果，为学生生成3个针对薄弱环节的深度追问。
                严格只输出 JSON：{"questions":[{"question":"问题","focus":"关注点"},{"question":"问题","focus":"关注点"},{"question":"问题","focus":"关注点"}]}
                【原始知识】%s
                【评估结果】%s
                """.formatted(request.originalContent(), request.evaluationResult());
        JsonNode json = jsonParser.parseJson(aiClient.answer(prompt));
        if (!json.path("questions").isArray() || json.path("questions").size() != 3) invalid();
        return json;
    }

    public Map<String, Object> compare(String userId, CompareAttemptsRequest request) {
        requireOwnedPoint(userId, request.knowledgePointId());
        List<FeynmanAttemptEntity> attempts = attemptMapper.selectList(new LambdaQueryWrapper<FeynmanAttemptEntity>()
                .eq(FeynmanAttemptEntity::getKnowledgePointId, request.knowledgePointId())
                .eq(FeynmanAttemptEntity::getAuthorId, userId)
                .orderByDesc(FeynmanAttemptEntity::getCreatedAt)
                .last("LIMIT 5"));
        if (attempts.size() < 2) return Map.of("hasHistory", false, "msg", "历史记录不足，需要至少2次复述");
        FeynmanAttemptEntity latest = attempts.get(0);
        FeynmanAttemptEntity previous = attempts.get(1);
        String prompt = """
                对比两次费曼复述，只输出 JSON：
                {"improvements":["进步"],"regressions":["退步"],"suggestions":["建议"]}
                上一次：得分%s，反馈%s
                最新一次：得分%s，反馈%s
                """.formatted(score(previous), value(previous.getFeedback()), score(latest), value(latest.getFeedback()));
        JsonNode json = jsonParser.parseJson(aiClient.answer(prompt));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("hasHistory", true);
        result.put("scoreChange", score(latest).subtract(score(previous)));
        result.put("improvements", strings(json, "improvements"));
        result.put("regressions", strings(json, "regressions"));
        result.put("suggestions", strings(json, "suggestions"));
        result.put("attempts", attempts.stream().limit(3).map(AttemptResponse::from).toList());
        return result;
    }

    private KnowledgePointEntity requireOwnedPoint(String userId, String id) {
        KnowledgePointEntity point = pointMapper.selectById(id);
        if (point == null) throw new ApiException(HttpStatus.NOT_FOUND, "KNOWLEDGE_POINT_NOT_FOUND", "Knowledge point not found");
        if (!userId.equals(point.getAuthorId())) throw new ApiException(HttpStatus.FORBIDDEN, "NOT_AUTHORIZED", "Not authorized");
        return point;
    }

    private JsonNode object(JsonNode parent, String field) {
        JsonNode value = parent.path(field);
        if (!value.isObject()) invalid();
        return value;
    }

    private List<String> strings(JsonNode parent, String field) {
        JsonNode array = parent.path(field);
        if (!array.isArray()) invalid();
        java.util.ArrayList<String> result = new java.util.ArrayList<>();
        array.forEach(value -> { if (value.isTextual() && !value.asText().isBlank()) result.add(value.asText().trim()); });
        return result;
    }

    private List<Map<String, String>> misconceptions(JsonNode array) {
        if (!array.isArray()) invalid();
        java.util.ArrayList<Map<String, String>> result = new java.util.ArrayList<>();
        array.forEach(value -> {
            String point = value.path("point").asText("").trim();
            String correction = value.path("correction").asText("").trim();
            if (!point.isEmpty() && !correction.isEmpty()) result.add(Map.of("point", point, "correction", correction));
        });
        return result;
    }

    private int boundedScore(JsonNode parent, String field) {
        if (!parent.path(field).isNumber()) invalid();
        return Math.max(0, Math.min(100, parent.path(field).intValue()));
    }

    private BigDecimal score(FeynmanAttemptEntity attempt) {
        return attempt.getScore() == null ? BigDecimal.ZERO : attempt.getScore();
    }

    private String value(String value) { return value == null ? "" : value; }
    private void invalid() { throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_INVALID_RESPONSE", "AI 返回格式不完整"); }
}
