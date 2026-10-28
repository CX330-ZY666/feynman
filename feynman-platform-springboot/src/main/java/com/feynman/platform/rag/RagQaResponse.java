package com.feynman.platform.rag;

import java.util.List;

public record RagQaResponse(String answer, List<RagSearchResult> sources) {
}
