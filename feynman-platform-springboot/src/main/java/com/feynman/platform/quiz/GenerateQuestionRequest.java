package com.feynman.platform.quiz;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record GenerateQuestionRequest(
        @NotBlank @Size(min = 10, max = 10000) String knowledgePointContent,
        @NotBlank @Pattern(regexp = "基础|中等|困难") String difficulty,
        @Pattern(regexp = "single-choice|short-answer") String type
) {
    public GenerateQuestionRequest {
        knowledgePointContent = com.feynman.platform.common.LearningText.plain(knowledgePointContent);
    }
    public String effectiveType() {
        return type == null ? "single-choice" : type;
    }
}
