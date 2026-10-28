package com.feynman.platform.rag;

import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class RagTextSplitter {
    static final int CHUNK_SIZE = 500;
    static final int CHUNK_OVERLAP = 50;

    public List<String> split(String text) {
        if (text == null || text.isBlank()) return List.of();
        String normalized = com.feynman.platform.common.LearningText.plain(text).replace("\r\n", "\n").replace('\r', '\n').trim();
        List<String> chunks = new ArrayList<>();
        int start = 0;
        while (start < normalized.length()) {
            int hardEnd = Math.min(start + CHUNK_SIZE, normalized.length());
            int end = hardEnd;
            if (hardEnd < normalized.length()) {
                int boundary = bestBoundary(normalized, start, hardEnd);
                if (boundary > start + CHUNK_SIZE / 2) end = boundary;
            }
            String chunk = normalized.substring(start, end).trim();
            if (!chunk.isEmpty()) chunks.add(chunk);
            if (end >= normalized.length()) break;
            int next = Math.max(start + 1, end - CHUNK_OVERLAP);
            while (next < end && Character.isWhitespace(normalized.charAt(next))) next++;
            start = next;
        }
        return chunks;
    }

    private int bestBoundary(String text, int start, int end) {
        String separators = "\n。！？；.!?;";
        for (int index = end - 1; index > start; index--) {
            if (separators.indexOf(text.charAt(index)) >= 0) return index + 1;
        }
        return end;
    }
}
