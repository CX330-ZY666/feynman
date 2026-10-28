package com.feynman.platform.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.jsonwebtoken.JwtException;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class JwtServiceTests {
    private final JwtService jwtService = new JwtService(
            "0123456789abcdef0123456789abcdef",
            "fedcba9876543210fedcba9876543210",
            Duration.ofHours(24),
            Duration.ofDays(7)
    );

    @Test
    void accessTokenContainsUserId() {
        String token = jwtService.createAccessToken("0123456789abcdef01234567");
        assertEquals("0123456789abcdef01234567", jwtService.parseAccessToken(token));
    }

    @Test
    void refreshTokenCannotBeUsedAsAccessToken() {
        String token = jwtService.createRefreshToken("0123456789abcdef01234567");
        assertThrows(JwtException.class, () -> jwtService.parseAccessToken(token));
    }
}
