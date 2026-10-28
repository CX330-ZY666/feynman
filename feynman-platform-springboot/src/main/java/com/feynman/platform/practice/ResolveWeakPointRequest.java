package com.feynman.platform.practice;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ResolveWeakPointRequest(
        @NotBlank @Pattern(regexp = "[0-9a-fA-F]{24}") String knowledgePointId,
        @NotBlank @Pattern(regexp = "[0-9a-fA-F]{24}") String weakPointId
) {
}
