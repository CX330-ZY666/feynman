package com.feynman.platform.evaluation;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record FollowUpQuestionsRequest(
        @NotNull JsonNode evaluationResult,
        @NotBlank @Size(max = 20000) String originalContent
) {
}
