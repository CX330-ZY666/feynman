package com.feynman.platform.practice;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.feynman.platform.common.ApiException;
import com.feynman.platform.knowledge.KnowledgePointEntity;
import com.feynman.platform.knowledge.KnowledgePointMapper;
import com.feynman.platform.user.UserIdGenerator;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FeynmanPracticeService {
    private final WeakPointMapper weakPointMapper;
    private final KnowledgePointMapper knowledgePointMapper;
    private final UserIdGenerator idGenerator;

    public FeynmanPracticeService(
            WeakPointMapper weakPointMapper,
            KnowledgePointMapper knowledgePointMapper,
            UserIdGenerator idGenerator
    ) {
        this.weakPointMapper = weakPointMapper;
        this.knowledgePointMapper = knowledgePointMapper;
        this.idGenerator = idGenerator;
    }

    @Transactional
    public WeakPointListResponse saveWeakPoint(String userId, SaveWeakPointRequest request) {
        requireOwnedPoint(userId, request.knowledgePointId());
        LocalDateTime now = LocalDateTime.now();
        WeakPointEntity entity = new WeakPointEntity();
        entity.setId(idGenerator.nextId());
        entity.setKnowledgePointId(request.knowledgePointId());
        entity.setAuthorId(userId);
        entity.setContent(request.weakPoint().trim());
        entity.setResolved(false);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        weakPointMapper.insert(entity);
        return new WeakPointListResponse(true, listWeakPoints(userId, request.knowledgePointId()));
    }

    @Transactional
    public WeakPointUpdateResponse toggleResolved(String userId, ResolveWeakPointRequest request) {
        requireOwnedPoint(userId, request.knowledgePointId());
        WeakPointEntity entity = weakPointMapper.selectOne(new LambdaQueryWrapper<WeakPointEntity>()
                .eq(WeakPointEntity::getId, request.weakPointId())
                .eq(WeakPointEntity::getKnowledgePointId, request.knowledgePointId())
                .eq(WeakPointEntity::getAuthorId, userId));
        if (entity == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "WEAK_POINT_NOT_FOUND", "Weak point not found");
        }
        entity.setResolved(!Boolean.TRUE.equals(entity.getResolved()));
        entity.setUpdatedAt(LocalDateTime.now());
        weakPointMapper.updateById(entity);
        return new WeakPointUpdateResponse(true, WeakPointResponse.from(entity));
    }

    public PracticeSummaryResponse summarize(String userId, PracticeSummaryRequest request) {
        requireOwnedPoint(userId, request.knowledgePointId());
        List<ConversationMessage> history = request.conversationHistory() == null
                ? List.of() : request.conversationHistory();
        if (history.isEmpty()) {
            return new PracticeSummaryResponse("本次练习没有对话记录", 0, List.of());
        }
        long userAnswers = history.stream().filter(message -> "user".equals(message.role())).count();
        long aiQuestions = history.stream().filter(message -> "ai".equals(message.role())).count();
        String summary = "本次练习共进行了 " + aiQuestions + " 轮提问，你完成了 " + userAnswers + " 次回答。";
        return new PracticeSummaryResponse(summary, aiQuestions, List.of(
                "复习回答中表达不够清楚的部分",
                "尝试用更简单的语言重新讲解",
                "结合一个实际例子检验自己的理解"
        ));
    }

    private List<WeakPointResponse> listWeakPoints(String userId, String knowledgePointId) {
        return weakPointMapper.selectList(new LambdaQueryWrapper<WeakPointEntity>()
                        .eq(WeakPointEntity::getKnowledgePointId, knowledgePointId)
                        .eq(WeakPointEntity::getAuthorId, userId)
                        .orderByAsc(WeakPointEntity::getCreatedAt))
                .stream().map(WeakPointResponse::from).toList();
    }

    private void requireOwnedPoint(String userId, String id) {
        KnowledgePointEntity point = knowledgePointMapper.selectById(id);
        if (point == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "KNOWLEDGE_POINT_NOT_FOUND", "Knowledge point not found");
        }
        if (!userId.equals(point.getAuthorId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_AUTHORIZED", "Not authorized");
        }
    }
}
