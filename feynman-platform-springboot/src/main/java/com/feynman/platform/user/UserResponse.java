package com.feynman.platform.user;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;

public record UserResponse(
        @JsonProperty("_id") String id,
        String username,
        String email,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        boolean guest,
        java.time.Instant guestExpiresAt
) {
    public static UserResponse from(UserEntity user) {
        return new UserResponse(user.getId(), user.isGuest() ? "体验访客" : user.getUsername(), user.isGuest() ? null : user.getEmail(), user.getCreatedAt(), user.getUpdatedAt(), user.isGuest(), user.getGuestExpiresAt()==null?null:user.getGuestExpiresAt().toInstant(java.time.ZoneOffset.UTC));
    }
}
