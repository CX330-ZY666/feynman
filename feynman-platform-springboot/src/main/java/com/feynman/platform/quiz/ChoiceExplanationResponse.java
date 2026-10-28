package com.feynman.platform.quiz;

public record ChoiceExplanationResponse(
        boolean isCorrect,
        String userAnswer,
        String correctAnswer,
        String correctExplanation,
        String wrongExplanation,
        String knowledgePoints
) {
}
