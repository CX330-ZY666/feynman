package com.feynman.platform.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AccountRequests {
    private AccountRequests() {}
    public record Profile(@NotBlank @Size(min = 2, max = 50) String username) {}
    public record Password(@NotBlank String currentPassword,
                           @NotBlank @Size(min = 6, max = 72) String newPassword) {}
    public record Deletion(@NotBlank String password, @NotBlank String confirmation) {}
}
