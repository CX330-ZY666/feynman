package com.feynman.platform.knowledge;

import jakarta.validation.constraints.NotNull;

public record ReviewRequest(@NotNull(message = "reviewList must be a boolean value") Boolean reviewList) {
}
