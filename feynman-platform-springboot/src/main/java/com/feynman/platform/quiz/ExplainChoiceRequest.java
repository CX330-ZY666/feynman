package com.feynman.platform.quiz;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;

public record ExplainChoiceRequest(
        @NotBlank @Size(max = 5000) String question,
        @NotNull Map<@Pattern(regexp = "A|B|C|D") String, @NotBlank @Size(max = 2000) String> options,
        @NotBlank @Pattern(regexp = "A|B|C|D") String correctAnswer,
        @NotBlank @Pattern(regexp = "A|B|C|D") String userAnswer,
        @Size(max = 5000) String originalExplanation
) {
}
