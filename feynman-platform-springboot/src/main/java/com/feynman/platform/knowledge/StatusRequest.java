package com.feynman.platform.knowledge;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record StatusRequest(
        @NotNull @Pattern(regexp = "learning|mastered|reviewing", message = "Invalid status value") String status
) {
}
