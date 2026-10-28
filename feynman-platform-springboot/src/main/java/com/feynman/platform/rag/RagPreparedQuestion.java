package com.feynman.platform.rag;

import java.util.List;

public record RagPreparedQuestion(
        String question,
        String prompt,
        List<RagSearchResult> sources,
        String directAnswer
) {
    public boolean needsAi() {
        return directAnswer == null;
    }
}
