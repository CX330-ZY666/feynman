package com.feynman.platform.relation;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record KnowledgeRelationResponse(
        @JsonProperty("_id") String id,
        String source,
        String target,
        String type,
        String relationType,
        BigDecimal strength,
        String relationLabel,
        String description,
        String author,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static KnowledgeRelationResponse from(KnowledgeRelationEntity entity) {
        return new KnowledgeRelationResponse(
                entity.getId(), entity.getSourceId(), entity.getTargetId(), entity.getType(),
                entity.getRelationType(), entity.getStrength(), entity.getRelationLabel(),
                entity.getDescription(), entity.getAuthorId(), entity.getCreatedAt(), entity.getUpdatedAt()
        );
    }
}
