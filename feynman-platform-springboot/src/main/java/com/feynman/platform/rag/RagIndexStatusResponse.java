package com.feynman.platform.rag;

public record RagIndexStatusResponse(long knowledgePoints, long chunks, long pending, long ready, long failed) {
}
