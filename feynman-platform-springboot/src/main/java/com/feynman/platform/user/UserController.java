package com.feynman.platform.user;

import com.feynman.platform.common.ApiException;
import com.feynman.platform.security.CurrentUser;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/register")
    public TokenResponse register(@Valid @RequestBody RegisterRequest request) {
        return userService.register(request);
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        return userService.login(request);
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestHeader(value = "x-refresh-token", required = false) String refreshHeader,
            @RequestBody(required = false) RefreshRequest body
    ) {
        String token = bearerToken(authorization);
        if (token == null || token.isBlank()) token = refreshHeader;
        if ((token == null || token.isBlank()) && body != null) token = body.refreshToken();
        if (token == null || token.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NO_REFRESH_TOKEN", "No refresh token provided");
        }
        try {
            return userService.refresh(token.trim());
        } catch (ExpiredJwtException exception) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "REFRESH_EXPIRED", "Refresh token expired");
        } catch (JwtException | IllegalArgumentException exception) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "REFRESH_INVALID", "Invalid refresh token");
        }
    }

    @GetMapping("/me")
    public UserResponse me(Authentication authentication) {
        return userService.currentUser(CurrentUser.id(authentication));
    }

    @PutMapping("/me")
    public UserResponse updateProfile(Authentication authentication, @Valid @RequestBody AccountRequests.Profile request) {
        return userService.updateProfile(CurrentUser.id(authentication), request);
    }

    @PutMapping("/me/password")
    public java.util.Map<String, String> changePassword(Authentication authentication, @Valid @RequestBody AccountRequests.Password request) {
        userService.changePassword(CurrentUser.id(authentication), request);
        return java.util.Map.of("message", "密码已修改，请重新登录");
    }

    @DeleteMapping("/me")
    public java.util.Map<String, String> deleteAccount(Authentication authentication, @Valid @RequestBody AccountRequests.Deletion request) {
        userService.deleteAccount(CurrentUser.id(authentication), request);
        return java.util.Map.of("message", "账号已注销");
    }

    private String bearerToken(String authorization) {
        return authorization != null && authorization.startsWith("Bearer ")
                ? authorization.substring(7).trim()
                : null;
    }
}
