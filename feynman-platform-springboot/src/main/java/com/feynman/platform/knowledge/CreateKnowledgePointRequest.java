package com.feynman.platform.knowledge;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateKnowledgePointRequest(
        @NotBlank @Size(max = 255) String title,
        @NotBlank String content,
        @Size(max = 100) String category,
        @Size(max = 30) List<@NotBlank @Size(max = 100) String> tags,
        @Pattern(regexp = "learning|mastered|reviewing") String status,
        @Pattern(regexp = "beginner|intermediate|advanced") String difficulty,
        Boolean isPublic
) {
}
