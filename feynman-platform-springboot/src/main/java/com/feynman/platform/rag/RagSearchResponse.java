package com.feynman.platform.rag;

import java.util.List;

public record RagSearchResponse(List<RagSearchResult> sources) {
}
