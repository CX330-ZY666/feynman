package com.feynman.platform.knowledge;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import java.util.List;

public record KnowledgePointResponse(
        @JsonProperty("_id") String id,
        String title,
        String content,
        String category,
        List<String> tags,
        String author,
        String difficulty,
        Boolean isPublic,
        Integer views,
        List<String> likes,
        String status,
        Boolean reviewList,
        List<Object> weakPoints,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static KnowledgePointResponse from(KnowledgePointEntity entity, List<String> tags) {
        return new KnowledgePointResponse(
                entity.getId(), entity.getTitle(), entity.getContent(), entity.getCategory(), tags,
                entity.getAuthorId(), entity.getDifficulty(), entity.getIsPublic(), entity.getViews(),
                List.of(), entity.getStatus(), entity.getReviewList(), List.of(),
                entity.getCreatedAt(), entity.getUpdatedAt()
        );
    }
}
