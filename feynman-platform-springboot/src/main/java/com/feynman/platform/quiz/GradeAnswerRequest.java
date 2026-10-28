package com.feynman.platform.quiz;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record GradeAnswerRequest(
        @NotBlank @Size(max = 5000) String question,
        @NotEmpty @Size(max = 20) List<@NotBlank @Size(max = 2000) String> answerKeyPoints,
        @NotBlank @Size(min = 5, max = 10000) String studentAnswer,
        @Pattern(regexp = "[0-9a-fA-F]{24}") String knowledgePointId
) {
}
