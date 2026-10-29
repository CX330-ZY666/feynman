package com.feynman.platform.knowledge;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.feynman.platform.common.ApiException;
import com.feynman.platform.user.UserIdGenerator;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KnowledgePointService {
    private final KnowledgePointMapper knowledgePointMapper;
    private final KnowledgePointTagMapper tagMapper;
    private final UserIdGenerator idGenerator;
    private final com.feynman.platform.user.UserMapper users;

    public KnowledgePointService(
            KnowledgePointMapper knowledgePointMapper,
            KnowledgePointTagMapper tagMapper,
            UserIdGenerator idGenerator,
            com.feynman.platform.user.UserMapper users
    ) {
        this.knowledgePointMapper = knowledgePointMapper;
        this.tagMapper = tagMapper;
        this.idGenerator = idGenerator;
        this.users = users;
    }

    @Transactional
    public KnowledgePointResponse create(String userId, CreateKnowledgePointRequest request) {
        checkGuestContent(userId, request.title(), request.content(), true);
        KnowledgePointEntity entity = new KnowledgePointEntity();
        entity.setId(idGenerator.nextId());
        entity.setTitle(request.title().trim());
        entity.setContent(request.content());
        entity.setCategory(defaultText(request.category(), "general"));
        entity.setAuthorId(userId);
        entity.setDifficulty(defaultText(request.difficulty(), "beginner"));
        entity.setIsPublic(request.isPublic() == null || request.isPublic());
        entity.setViews(0);
        entity.setStatus(defaultText(request.status(), "learning"));
        entity.setReviewList(false);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        knowledgePointMapper.insert(entity);
        List<String> tags = replaceTags(entity.getId(), request.tags());
        return KnowledgePointResponse.from(entity, tags);
    }

    public KnowledgePointListResponse list(String userId) {
        List<KnowledgePointEntity> entities = knowledgePointMapper.selectList(
                new LambdaQueryWrapper<KnowledgePointEntity>()
                        .eq(KnowledgePointEntity::getAuthorId, userId)
                        .orderByDesc(KnowledgePointEntity::getCreatedAt)
        );
        Map<String, List<String>> tags = loadTags(entities.stream().map(KnowledgePointEntity::getId).toList());
        List<KnowledgePointResponse> responses = entities.stream()
                .map(entity -> KnowledgePointResponse.from(entity, tags.getOrDefault(entity.getId(), List.of())))
                .toList();
        return new KnowledgePointListResponse(responses, List.of());
    }

    public KnowledgePointResponse get(String userId, String id) {
        KnowledgePointEntity entity = owned(userId, id);
        return KnowledgePointResponse.from(entity, loadTags(List.of(id)).getOrDefault(id, List.of()));
    }

    @Transactional
    public KnowledgePointResponse update(String userId, String id, UpdateKnowledgePointRequest request) {
        checkGuestContent(userId, request.title(), request.content(), false);
        KnowledgePointEntity entity = owned(userId, id);
        setIfNotNull(request.title(), value -> entity.setTitle(value.trim()));
        setIfNotNull(request.content(), entity::setContent);
        setIfNotNull(request.category(), value -> entity.setCategory(value.trim()));
        setIfNotNull(request.status(), entity::setStatus);
        setIfNotNull(request.difficulty(), entity::setDifficulty);
        setIfNotNull(request.isPublic(), entity::setIsPublic);
        setIfNotNull(request.reviewList(), entity::setReviewList);
        entity.setUpdatedAt(LocalDateTime.now());
        knowledgePointMapper.updateById(entity);
        List<String> tags = request.tags() == null
                ? loadTags(List.of(id)).getOrDefault(id, List.of())
                : replaceTags(id, request.tags());
        return KnowledgePointResponse.from(entity, tags);
    }

    @Transactional
    public void delete(String userId, String id) {
        owned(userId, id);
        knowledgePointMapper.deleteAttempts(id);
        knowledgePointMapper.deleteById(id);
    }

    private void checkGuestContent(String userId, String title, String content, boolean creating) {
        var user = users.selectById(userId);
        if (user == null || !user.isGuest()) return;
        user = users.lockById(userId);
        if (user == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "GUEST_EXPIRED", "体验已结束，请重新进入或注册正式账号");
        if (!user.isGuest()) return;
        if ((title != null && title.length() > 100) || (content != null && content.length() > 3000)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "GUEST_CONTENT_LIMIT", "体验模式标题最多100字、正文最多3000字符，请缩短内容或注册正式账号");
        }
        if (creating && knowledgePointMapper.selectCount(new LambdaQueryWrapper<KnowledgePointEntity>().eq(KnowledgePointEntity::getAuthorId,userId)) >= 5) {
            throw new ApiException(HttpStatus.FORBIDDEN, "GUEST_KNOWLEDGE_LIMIT", "体验模式最多保留5个知识点，请先删除示例或注册正式账号");
        }
    }

    @Transactional
    public KnowledgePointUpdateResponse updateStatus(String userId, String id, String status) {
        KnowledgePointEntity entity = owned(userId, id);
        entity.setStatus(status);
        entity.setUpdatedAt(LocalDateTime.now());
        knowledgePointMapper.updateById(entity);
        return new KnowledgePointUpdateResponse("Status updated successfully", get(userId, id));
    }

    @Transactional
    public KnowledgePointUpdateResponse updateReview(String userId, String id, Boolean reviewList) {
        KnowledgePointEntity entity = owned(userId, id);
        entity.setReviewList(reviewList);
        entity.setUpdatedAt(LocalDateTime.now());
        knowledgePointMapper.updateById(entity);
        return new KnowledgePointUpdateResponse("Review status updated successfully", get(userId, id));
    }

    private KnowledgePointEntity owned(String userId, String id) {
        if (id == null || !id.matches("[0-9a-fA-F]{24}")) {
            throw new ApiException(HttpStatus.NOT_FOUND, "KNOWLEDGE_POINT_NOT_FOUND", "Knowledge point not found");
        }
        KnowledgePointEntity entity = knowledgePointMapper.selectById(id);
        if (entity == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "KNOWLEDGE_POINT_NOT_FOUND", "Knowledge point not found");
        }
        if (!userId.equals(entity.getAuthorId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_AUTHORIZED", "Not authorized to update this knowledge point");
        }
        return entity;
    }

    private List<String> replaceTags(String knowledgePointId, List<String> requestedTags) {
        tagMapper.delete(new LambdaQueryWrapper<KnowledgePointTagEntity>()
                .eq(KnowledgePointTagEntity::getKnowledgePointId, knowledgePointId));
        List<String> tags = normalizeTags(requestedTags);
        for (String tag : tags) {
            KnowledgePointTagEntity entity = new KnowledgePointTagEntity();
            entity.setKnowledgePointId(knowledgePointId);
            entity.setTag(tag);
            tagMapper.insert(entity);
        }
        return tags;
    }

    private Map<String, List<String>> loadTags(List<String> knowledgePointIds) {
        if (knowledgePointIds.isEmpty()) return Map.of();
        return tagMapper.selectList(new LambdaQueryWrapper<KnowledgePointTagEntity>()
                        .in(KnowledgePointTagEntity::getKnowledgePointId, knowledgePointIds)
                        .orderByAsc(KnowledgePointTagEntity::getId))
                .stream()
                .collect(Collectors.groupingBy(
                        KnowledgePointTagEntity::getKnowledgePointId,
                        Collectors.mapping(KnowledgePointTagEntity::getTag, Collectors.toList())
                ));
    }

    private List<String> normalizeTags(List<String> tags) {
        if (tags == null) return List.of();
        LinkedHashSet<String> unique = tags.stream()
                .filter(tag -> tag != null && !tag.isBlank())
                .map(String::trim)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        return new ArrayList<>(unique);
    }

    private String defaultText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private <T> void setIfNotNull(T value, Consumer<T> setter) {
        if (value != null) setter.accept(value);
    }
}
