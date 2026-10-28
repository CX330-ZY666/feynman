package com.feynman.platform.practice;

import java.util.List;

public record UnderstandingEvaluationResponse(
        int understandingScore,
        boolean isParroting,
        List<String> strengths,
        List<String> weaknesses,
        String feedback
) {
}
