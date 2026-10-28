package com.feynman.platform.practice;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record PracticeSummaryRequest(
        @NotBlank @Pattern(regexp = "[0-9a-fA-F]{24}") String knowledgePointId,
        @Size(max = 100) List<@Valid ConversationMessage> conversationHistory
) {
}
