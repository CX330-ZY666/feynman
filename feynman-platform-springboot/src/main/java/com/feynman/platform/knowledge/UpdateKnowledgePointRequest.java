package com.feynman.platform.knowledge;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record UpdateKnowledgePointRequest(
        @Size(min = 1, max = 255) String title,
        @Size(min = 1) String content,
        @Size(max = 100) String category,
        @Size(max = 30) List<@Size(min = 1, max = 100) String> tags,
        @Pattern(regexp = "learning|mastered|reviewing") String status,
        @Pattern(regexp = "beginner|intermediate|advanced") String difficulty,
        Boolean isPublic,
        Boolean reviewList
) {
}
