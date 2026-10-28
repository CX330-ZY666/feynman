package com.feynman.platform.attempt;

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
public class FeynmanAttemptService {
    private final FeynmanAttemptMapper attemptMapper;
    private final KnowledgePointMapper knowledgePointMapper;
    private final UserIdGenerator idGenerator;

    public FeynmanAttemptService(
            FeynmanAttemptMapper attemptMapper,
            KnowledgePointMapper knowledgePointMapper,
            UserIdGenerator idGenerator
    ) {
        this.attemptMapper = attemptMapper;
        this.knowledgePointMapper = knowledgePointMapper;
        this.idGenerator = idGenerator;
    }

    @Transactional
    public AttemptResponse create(String userId, CreateAttemptRequest request) {
        requireOwnedPoint(userId, request.knowledgePointId());
        String transcribed = clean(request.transcribedText());
        String polished = clean(request.polishedText());
        if (transcribed.isEmpty() && polished.isEmpty()) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "ATTEMPT_TEXT_REQUIRED",
                    "transcribedText 和 polishedText 至少提供一项"
            );
        }
        FeynmanAttemptEntity entity = baseEntity(userId, request.knowledgePointId());
        entity.setTranscribedText(transcribed);
        entity.setPolishedText(polished);
        entity.setStandardAnswer(value(request.standardAnswer()));
        entity.setScore(request.score());
        entity.setFeedback(value(request.feedback()));
        entity.setDurationMs(request.durationMs());
        attemptMapper.insert(entity);
        return AttemptResponse.from(entity);
    }

    @Transactional
    public SimpleAttemptResponse createSimple(String userId, CreateSimpleAttemptRequest request) {
        requireOwnedPoint(userId, request.knowledgePointId());
        FeynmanAttemptEntity entity = baseEntity(userId, request.knowledgePointId());
        entity.setTranscribedText(request.text().trim());
        entity.setPolishedText("");
        entity.setStandardAnswer("");
        entity.setFeedback("");
        entity.setDurationSeconds(request.durationSeconds());
        attemptMapper.insert(entity);
        return SimpleAttemptResponse.from(entity);
    }

    public List<AttemptResponse> list(String userId, String knowledgePointId) {
        requireOwnedPoint(userId, knowledgePointId);
        return findAttempts(userId, knowledgePointId).stream().map(AttemptResponse::from).toList();
    }

    public List<SimpleAttemptResponse> listSimple(String userId, String knowledgePointId) {
        requireOwnedPoint(userId, knowledgePointId);
        return findAttempts(userId, knowledgePointId).stream().map(SimpleAttemptResponse::from).toList();
    }

    private List<FeynmanAttemptEntity> findAttempts(String userId, String knowledgePointId) {
        return attemptMapper.selectList(new LambdaQueryWrapper<FeynmanAttemptEntity>()
                .eq(FeynmanAttemptEntity::getKnowledgePointId, knowledgePointId)
                .eq(FeynmanAttemptEntity::getAuthorId, userId)
                .orderByDesc(FeynmanAttemptEntity::getCreatedAt));
    }

    private FeynmanAttemptEntity baseEntity(String userId, String knowledgePointId) {
        LocalDateTime now = LocalDateTime.now();
        FeynmanAttemptEntity entity = new FeynmanAttemptEntity();
        entity.setId(idGenerator.nextId());
        entity.setKnowledgePointId(knowledgePointId);
        entity.setAuthorId(userId);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return entity;
    }

    private void requireOwnedPoint(String userId, String id) {
        if (id == null || !id.matches("[0-9a-fA-F]{24}")) {
            throw new ApiException(HttpStatus.NOT_FOUND, "KNOWLEDGE_POINT_NOT_FOUND", "Knowledge point not found");
        }
        KnowledgePointEntity point = knowledgePointMapper.selectById(id);
        if (point == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "KNOWLEDGE_POINT_NOT_FOUND", "Knowledge point not found");
        }
        if (!userId.equals(point.getAuthorId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_AUTHORIZED", "Not authorized");
        }
    }

    private String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private String value(String value) {
        return value == null ? "" : value;
    }
}
