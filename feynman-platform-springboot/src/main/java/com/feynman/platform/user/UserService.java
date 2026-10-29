package com.feynman.platform.user;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.feynman.platform.common.ApiException;
import com.feynman.platform.security.JwtService;
import java.time.LocalDateTime;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {
    private final UserMapper userMapper;
    private final UserIdGenerator idGenerator;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public UserService(UserMapper userMapper, UserIdGenerator idGenerator, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.userMapper = userMapper;
        this.idGenerator = idGenerator;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public TokenResponse register(RegisterRequest request) {
        return register(request, null);
    }

    @Transactional
    public TokenResponse register(RegisterRequest request, String signedInUserId) {
        String email = request.email().trim().toLowerCase();
        String username = request.username().trim();
        if (findByEmail(email) != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "EMAIL_EXISTS", "Email already exists");
        }
        if (findByUsername(username) != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "USERNAME_EXISTS", "Username already exists");
        }

        UserEntity user = signedInUserId == null ? null : userMapper.lockById(signedInUserId);
        if (signedInUserId != null && (user == null || !user.isGuest())) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_REGISTERED", "当前账号已注册或体验已结束，请刷新页面后重试");
        }
        boolean upgrading = user != null && user.isGuest();
        if (upgrading && (user.getGuestExpiresAt() == null || !user.getGuestExpiresAt().isAfter(LocalDateTime.now(java.time.ZoneOffset.UTC)))) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "GUEST_EXPIRED", "体验已过期，请重新注册正式账号");
        }
        if (!upgrading) { user = new UserEntity(); user.setId(idGenerator.nextId()); user.setCreatedAt(LocalDateTime.now()); }
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setGuest(false);
        user.setGuestExpiresAt(null);
        if (upgrading) user.setAuthVersion(user.getAuthVersion() + 1);
        user.setUpdatedAt(LocalDateTime.now());
        try {
            if (upgrading) userMapper.updateById(user); else userMapper.insert(user);
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "USER_EXISTS", "Email or username already exists");
        }
        return issueTokens(user.getId());
    }

    public TokenResponse login(LoginRequest request) {
        UserEntity user = findByEmail(request.email().trim().toLowerCase());
        if (user == null || user.isGuest() || !passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CREDENTIALS", "Invalid credentials");
        }
        return issueTokens(user.getId());
    }

    public TokenResponse refresh(String refreshToken) {
        String userId = jwtService.parseRefreshToken(refreshToken);
        UserEntity user = userMapper.selectById(userId);
        if (user == null || user.isGuest() || user.getAuthVersion() != jwtService.tokenVersion(refreshToken, true)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "REFRESH_INVALID", "Invalid refresh token");
        }
        return TokenResponse.accessOnly(jwtService.createAccessToken(userId, user.getAuthVersion()));
    }

    public UserResponse currentUser(String userId) {
        UserEntity user = userMapper.selectById(userId);
        if (user == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "User not found");
        }
        return UserResponse.from(user);
    }

    private TokenResponse issueTokens(String userId) {
        int version = requireUser(userId).getAuthVersion();
        return new TokenResponse(jwtService.createAccessToken(userId, version), jwtService.createRefreshToken(userId, version));
    }

    private UserEntity requireUser(String id) {
        UserEntity user = userMapper.selectById(id);
        if (user == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND", "账号不存在或已注销");
        return user;
    }

    private void verifyPassword(UserEntity user, String password) {
        if (user.isGuest()) throw new ApiException(HttpStatus.FORBIDDEN, "GUEST_RESTRICTED", "体验账号请先注册后管理账号安全");
        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PASSWORD", "当前密码不正确");
        }
    }

    private UserEntity lockUser(String id) {
        UserEntity user = userMapper.lockById(id);
        if (user == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "USER_NOT_FOUND", "账号不存在或已注销");
        return user;
    }

    @Transactional
    public UserResponse updateProfile(String id, AccountRequests.Profile request) {
        UserEntity user = lockUser(id);
        String name = request.username().trim();
        if (name.length() < 2) throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_USERNAME", "昵称至少需要两个字符");
        UserEntity other = findByUsername(name);
        if (other != null && !other.getId().equals(id)) throw new ApiException(HttpStatus.BAD_REQUEST, "USERNAME_EXISTS", "昵称已被使用");
        user.setUsername(name);
        user.setUpdatedAt(LocalDateTime.now());
        try { userMapper.updateById(user); }
        catch (DuplicateKeyException exception) { throw new ApiException(HttpStatus.BAD_REQUEST, "USERNAME_EXISTS", "昵称已被使用"); }
        return UserResponse.from(user);
    }

    @Transactional
    public void changePassword(String id, AccountRequests.Password request) {
        UserEntity user = lockUser(id);
        verifyPassword(user, request.currentPassword());
        if (request.newPassword().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_TOO_LONG", "密码不能超过72个UTF-8字节");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        user.setAuthVersion(user.getAuthVersion() + 1);
        user.setUpdatedAt(LocalDateTime.now());
        userMapper.updateById(user);
    }

    @Transactional
    public void deleteAccount(String id, AccountRequests.Deletion request) {
        UserEntity user = lockUser(id);
        verifyPassword(user, request.password());
        if (!"注销账号".equals(request.confirmation())) throw new ApiException(HttpStatus.BAD_REQUEST, "CONFIRMATION_REQUIRED", "请输入注销账号以确认");
        userMapper.deleteAttempts(id);
        userMapper.deleteWeakPoints(id);
        userMapper.deleteRelations(id);
        userMapper.deleteKnowledge(id);
        userMapper.deleteById(id);
    }

    private UserEntity findByEmail(String email) {
        return userMapper.selectOne(new LambdaQueryWrapper<UserEntity>().eq(UserEntity::getEmail, email).last("LIMIT 1"));
    }

    private UserEntity findByUsername(String username) {
        return userMapper.selectOne(new LambdaQueryWrapper<UserEntity>().eq(UserEntity::getUsername, username).last("LIMIT 1"));
    }
}
