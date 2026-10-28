package com.feynman.platform.rag;

import java.util.Map;

public record RagSearchResult(String content, Map<String, Object> metadata, double score) {
}
