package com.feynman.platform.rag;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RagSearchRequest(
        @NotBlank @Size(max = 2000) String question,
        @Min(1) @Max(10) Integer topK
) {
    public int effectiveTopK() {
        return topK == null ? 5 : topK;
    }
}
