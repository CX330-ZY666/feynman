package com.feynman.platform.attempt;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

public record CreateAttemptRequest(
        @NotBlank String knowledgePointId,
        String transcribedText,
        String polishedText,
        @DecimalMin("0") @DecimalMax("100") BigDecimal score,
        String feedback,
        String standardAnswer,
        @PositiveOrZero Long durationMs
) {
}
