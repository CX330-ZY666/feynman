package com.feynman.platform.user;

import com.feynman.platform.common.ApiException;
import com.feynman.platform.security.JwtService;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountServiceTests {
    private UserMapper mapper;
    private UserService service;
    private JwtService jwt;
    private UserEntity user;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);

    @BeforeEach void setup() {
        mapper = mock(UserMapper.class);
        jwt = new JwtService("access-secret-for-account-tests-123456", "refresh-secret-for-account-tests-123456", Duration.ofHours(1), Duration.ofDays(1));
        service = new UserService(mapper, mock(UserIdGenerator.class), encoder, jwt);
        user = new UserEntity(); user.setId("account-1"); user.setUsername("原昵称"); user.setPassword(encoder.encode("old-password"));
        when(mapper.lockById(user.getId())).thenReturn(user);
        when(mapper.selectById(user.getId())).thenReturn(user);
    }

    @Test void updatesNicknameAndRejectsDuplicate() {
        assertEquals("新昵称", service.updateProfile(user.getId(), new AccountRequests.Profile(" 新昵称 ")).username());
        UserEntity other = new UserEntity(); other.setId("other");
        when(mapper.selectOne(any())).thenReturn(other);
        assertThrows(ApiException.class, () -> service.updateProfile(user.getId(), new AccountRequests.Profile("被占用")));
    }

    @Test void passwordRequiresCurrentPassword() {
        assertThrows(ApiException.class, () -> service.changePassword(user.getId(), new AccountRequests.Password("wrong", "new-password")));
        verify(mapper, never()).updateById(any(UserEntity.class));
    }

    @Test void passwordChangeRevokesOldRefreshToken() {
        String old = jwt.createRefreshToken(user.getId(), 0);
        service.changePassword(user.getId(), new AccountRequests.Password("old-password", "new-password"));
        assertTrue(encoder.matches("new-password", user.getPassword()));
        assertEquals(1, user.getAuthVersion());
        assertThrows(ApiException.class, () -> service.refresh(old));
        assertNotNull(service.refresh(jwt.createRefreshToken(user.getId(), 1)));
    }

    @Test void deletionRequiresPasswordAndExplicitConfirmation() {
        assertThrows(ApiException.class, () -> service.deleteAccount(user.getId(), new AccountRequests.Deletion("wrong", "注销账号")));
        assertThrows(ApiException.class, () -> service.deleteAccount(user.getId(), new AccountRequests.Deletion("old-password", "yes")));
        verify(mapper, never()).deleteAttempts(anyString());
    }

    @Test void deletesDependentsBeforeUser() {
        service.deleteAccount(user.getId(), new AccountRequests.Deletion("old-password", "注销账号"));
        var order = inOrder(mapper);
        order.verify(mapper).deleteAttempts(user.getId());
        order.verify(mapper).deleteWeakPoints(user.getId());
        order.verify(mapper).deleteRelations(user.getId());
        order.verify(mapper).deleteKnowledge(user.getId());
        order.verify(mapper).deleteById(user.getId());
    }
}
