package com.feynman.platform.evaluation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record CompareAttemptsRequest(
        @NotBlank @Pattern(regexp = "[0-9a-fA-F]{24}") String knowledgePointId
) {
}
