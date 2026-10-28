package com.feynman.platform.rag;

public record RagEmbeddingResponse(int processed, int ready, int failed, String model, int dimensions) {
}
