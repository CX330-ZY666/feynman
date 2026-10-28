package com.feynman.platform.relation;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.feynman.platform.common.ApiException;
import com.feynman.platform.knowledge.KnowledgePointEntity;
import com.feynman.platform.knowledge.KnowledgePointMapper;
import com.feynman.platform.user.UserIdGenerator;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KnowledgeRelationService {
    private final KnowledgeRelationMapper relationMapper;
    private final KnowledgePointMapper knowledgePointMapper;
    private final UserIdGenerator idGenerator;

    public KnowledgeRelationService(
            KnowledgeRelationMapper relationMapper,
            KnowledgePointMapper knowledgePointMapper,
            UserIdGenerator idGenerator
    ) {
        this.relationMapper = relationMapper;
        this.knowledgePointMapper = knowledgePointMapper;
        this.idGenerator = idGenerator;
    }

    @Transactional
    public KnowledgeRelationResponse create(String userId, CreateRelationRequest request) {
        if (request.source().equalsIgnoreCase(request.target())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "SELF_RELATION", "不能关联自己");
        }
        requireOwnedPoint(userId, request.source(), "源知识点不存在或无权访问");
        requireOwnedPoint(userId, request.target(), "目标知识点不存在或无权访问");

        boolean exists = relationMapper.selectCount(new LambdaQueryWrapper<KnowledgeRelationEntity>()
                .eq(KnowledgeRelationEntity::getSourceId, request.source())
                .eq(KnowledgeRelationEntity::getTargetId, request.target())
                .eq(KnowledgeRelationEntity::getAuthorId, userId)) > 0;
        if (exists) {
            throw new ApiException(HttpStatus.CONFLICT, "RELATION_EXISTS", "关系已存在");
        }

        KnowledgeRelationEntity entity = new KnowledgeRelationEntity();
        entity.setId(idGenerator.nextId());
        entity.setSourceId(request.source());
        entity.setTargetId(request.target());
        entity.setAuthorId(userId);
        entity.setType("manual");
        entity.setRelationType(defaultText(request.relationType(), "reference"));
        entity.setStrength(request.strength() == null ? new BigDecimal("0.500") : request.strength());
        entity.setRelationLabel(defaultText(request.relationLabel(), ""));
        entity.setDescription(defaultText(request.description(), ""));
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        try {
            relationMapper.insert(entity);
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "RELATION_EXISTS", "关系已存在");
        }
        return KnowledgeRelationResponse.from(entity);
    }

    public List<KnowledgeRelationResponse> list(String userId) {
        return relationMapper.selectList(new LambdaQueryWrapper<KnowledgeRelationEntity>()
                        .eq(KnowledgeRelationEntity::getAuthorId, userId)
                        .orderByDesc(KnowledgeRelationEntity::getCreatedAt))
                .stream().map(KnowledgeRelationResponse::from).toList();
    }

    @Transactional
    public void delete(String userId, String id) {
        if (id == null || !id.matches("[0-9a-fA-F]{24}")) {
            throw new ApiException(HttpStatus.NOT_FOUND, "RELATION_NOT_FOUND", "关系不存在");
        }
        KnowledgeRelationEntity entity = relationMapper.selectById(id);
        if (entity == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "RELATION_NOT_FOUND", "关系不存在");
        }
        if (!userId.equals(entity.getAuthorId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_AUTHORIZED", "无权删除此关系");
        }
        relationMapper.deleteById(id);
    }

    private void requireOwnedPoint(String userId, String id, String message) {
        KnowledgePointEntity point = knowledgePointMapper.selectById(id);
        if (point == null || !userId.equals(point.getAuthorId())) {
            throw new ApiException(HttpStatus.NOT_FOUND, "KNOWLEDGE_POINT_NOT_FOUND", message);
        }
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
