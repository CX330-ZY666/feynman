package com.feynman.platform.practice;

public record AskQuestionResponse(
        String question,
        boolean shouldContinue,
        String reason,
        String source
) {
}
