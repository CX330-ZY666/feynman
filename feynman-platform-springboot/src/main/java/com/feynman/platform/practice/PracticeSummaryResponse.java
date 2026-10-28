package com.feynman.platform.practice;

import java.util.List;

public record PracticeSummaryResponse(
        String summary,
        long questionCount,
        List<String> suggestions
) {
}
