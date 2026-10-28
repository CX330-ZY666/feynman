package com.feynman.platform.user;

public record TokenResponse(String token, String refreshToken) {
    public static TokenResponse accessOnly(String token) {
        return new TokenResponse(token, null);
    }
}
