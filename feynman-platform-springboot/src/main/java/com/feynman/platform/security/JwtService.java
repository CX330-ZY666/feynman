package com.feynman.platform.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.Map;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final SecretKey accessKey;
    private final SecretKey refreshKey;
    private final Duration accessLifetime;
    private final Duration refreshLifetime;

    public JwtService(
            @Value("${security.jwt.secret}") String accessSecret,
            @Value("${security.jwt.refresh-secret}") String refreshSecret,
            @Value("${security.jwt.access-lifetime:PT24H}") Duration accessLifetime,
            @Value("${security.jwt.refresh-lifetime:P7D}") Duration refreshLifetime
    ) {
        this.accessKey = createKey(accessSecret, "JWT_SECRET");
        this.refreshKey = createKey(refreshSecret, "JWT_REFRESH_SECRET");
        this.accessLifetime = accessLifetime;
        this.refreshLifetime = refreshLifetime;
    }

    public String createAccessToken(String userId) {
        return createToken(userId, accessKey, accessLifetime, "access");
    }

    public String createAccessToken(String userId, int version) {
        return createToken(userId, accessKey, accessLifetime, "access", version);
    }

    public String createRefreshToken(String userId, int version) {
        return createToken(userId, refreshKey, refreshLifetime, "refresh", version);
    }

    public int tokenVersion(String token, boolean refresh) {
        Claims claims = Jwts.parser().verifyWith(refresh ? refreshKey : accessKey).build()
                .parseSignedClaims(token).getPayload();
        Number version = claims.get("version", Number.class);
        return version == null ? 0 : version.intValue();
    }

    public String createRefreshToken(String userId) {
        return createToken(userId, refreshKey, refreshLifetime, "refresh");
    }

    public String parseAccessToken(String token) {
        return parseUserId(token, accessKey, "access");
    }

    public String parseRefreshToken(String token) {
        return parseUserId(token, refreshKey, "refresh");
    }

    private String createToken(String userId, SecretKey key, Duration lifetime, String tokenType) {
        return createToken(userId, key, lifetime, tokenType, 0);
    }

    private String createToken(String userId, SecretKey key, Duration lifetime, String tokenType, int version) {
        Date now = new Date();
        return Jwts.builder()
                .claims(Map.of("user", Map.of("id", userId), "type", tokenType, "version", version))
                .subject(userId)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + lifetime.toMillis()))
                .signWith(key)
                .compact();
    }

    private String parseUserId(String token, SecretKey key, String expectedType) {
        Claims claims = Jwts.parser().verifyWith(key).build()
                .parseSignedClaims(token).getPayload();
        if (!expectedType.equals(claims.get("type", String.class))) {
            throw new IllegalArgumentException("Token type mismatch");
        }
        return claims.getSubject();
    }

    private SecretKey createKey(String secret, String variableName) {
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException(variableName + " 至少需要 32 个字符");
        }
        return Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }
}
