package com.feynman.platform.practice;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SaveWeakPointRequest(
        @NotBlank @Pattern(regexp = "[0-9a-fA-F]{24}") String knowledgePointId,
        @NotBlank @Size(max = 5000) String weakPoint
) {
}
