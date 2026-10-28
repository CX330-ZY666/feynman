package com.feynman.platform.attempt;

import java.time.LocalDateTime;

public record SimpleAttemptResponse(
        String id,
        String knowledgePointId,
        String text,
        Long durationSeconds,
        LocalDateTime createdAt
) {
    public static SimpleAttemptResponse from(FeynmanAttemptEntity entity) {
        return new SimpleAttemptResponse(
                entity.getId(), entity.getKnowledgePointId(), entity.getTranscribedText(),
                entity.getDurationSeconds(), entity.getCreatedAt()
        );
    }
}
