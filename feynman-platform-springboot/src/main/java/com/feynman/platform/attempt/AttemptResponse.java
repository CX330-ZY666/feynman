package com.feynman.platform.attempt;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AttemptResponse(
        @JsonProperty("_id") String id,
        String knowledgePoint,
        String author,
        String transcribedText,
        String polishedText,
        String standardAnswer,
        BigDecimal score,
        String feedback,
        Long durationMs,
        Long durationSeconds,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static AttemptResponse from(FeynmanAttemptEntity entity) {
        return new AttemptResponse(
                entity.getId(), entity.getKnowledgePointId(), entity.getAuthorId(), entity.getTranscribedText(),
                entity.getPolishedText(), entity.getStandardAnswer(), entity.getScore(), entity.getFeedback(),
                entity.getDurationMs(), entity.getDurationSeconds(), entity.getCreatedAt(), entity.getUpdatedAt()
        );
    }
}
