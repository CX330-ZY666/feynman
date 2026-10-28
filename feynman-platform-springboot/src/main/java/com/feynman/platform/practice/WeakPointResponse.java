package com.feynman.platform.practice;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

public record WeakPointResponse(
        @JsonProperty("_id") String id,
        String content,
        boolean resolved,
        LocalDateTime createdAt
) {
    public static WeakPointResponse from(WeakPointEntity entity) {
        return new WeakPointResponse(
                entity.getId(),
                entity.getContent(),
                Boolean.TRUE.equals(entity.getResolved()),
                entity.getCreatedAt()
        );
    }
}
