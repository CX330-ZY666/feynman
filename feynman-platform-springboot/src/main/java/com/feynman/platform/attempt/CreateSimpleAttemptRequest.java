package com.feynman.platform.attempt;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;

public record CreateSimpleAttemptRequest(
        @NotBlank String knowledgePointId,
        @NotBlank String text,
        @PositiveOrZero Long durationSeconds
) {
}
