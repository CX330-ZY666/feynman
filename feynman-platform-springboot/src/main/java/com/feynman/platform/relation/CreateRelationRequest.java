package com.feynman.platform.relation;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record CreateRelationRequest(
        @NotBlank @Pattern(regexp = "[0-9a-fA-F]{24}") String source,
        @NotBlank @Pattern(regexp = "[0-9a-fA-F]{24}") String target,
        @Size(max = 50) String relationLabel,
        @Pattern(regexp = "prerequisite|derived|similar|contrast|application|includes|reference") String relationType,
        @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal strength,
        @Size(max = 200) String description
) {
}
