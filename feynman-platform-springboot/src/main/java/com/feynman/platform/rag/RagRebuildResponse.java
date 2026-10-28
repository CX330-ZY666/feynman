package com.feynman.platform.rag;

public record RagRebuildResponse(String msg, int count, int chunks, String status) {
}
