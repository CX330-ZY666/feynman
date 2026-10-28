package com.feynman.platform.evaluation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record EvaluateStagedRequest(
        @Size(max = 20000) String originalContent,
        @NotBlank @Size(max = 5000) String transcribedText,
        @Pattern(regexp = "[0-9a-fA-F]{24}") String knowledgePointId
) {
}
