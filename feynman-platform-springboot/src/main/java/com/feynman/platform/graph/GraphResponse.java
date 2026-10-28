package com.feynman.platform.graph;

import java.util.List;
import java.util.Map;

public record GraphResponse(List<Map<String, Object>> nodes, List<Map<String, Object>> links) {
    public static GraphResponse empty() {
        return new GraphResponse(List.of(), List.of());
    }
}
