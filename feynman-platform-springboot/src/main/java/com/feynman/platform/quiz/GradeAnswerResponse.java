package com.feynman.platform.quiz;

public record GradeAnswerResponse(
        int score,
        boolean isCorrect,
        String analysis,
        String suggestions,
        String standardAnswer
) {
}
