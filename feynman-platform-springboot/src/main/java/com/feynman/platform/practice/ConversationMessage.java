package com.feynman.platform.practice;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ConversationMessage(
        @NotBlank @Pattern(regexp = "user|ai") String role,
        @NotBlank @Size(max = 10000) String content
) {
}
