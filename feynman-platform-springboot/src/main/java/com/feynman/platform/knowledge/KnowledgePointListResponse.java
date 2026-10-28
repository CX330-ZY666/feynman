package com.feynman.platform.knowledge;

import java.util.List;

public record KnowledgePointListResponse(
        List<KnowledgePointResponse> knowledgePoints,
        List<Object> relations
) {
}
