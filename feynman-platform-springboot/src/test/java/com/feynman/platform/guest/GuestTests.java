package com.feynman.platform.guest;

import com.feynman.platform.common.ApiException;
import com.feynman.platform.knowledge.*;
import com.feynman.platform.security.*;
import com.feynman.platform.user.*;
import java.time.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mock.web.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.context.request.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GuestTests {
    final UserMapper users=mock(UserMapper.class);
    final GuestQuotaService quota=mock(GuestQuotaService.class);
    final GuestSettings settings=new GuestSettings(true,3,30,3,50);
    final JwtService jwt=new JwtService("test-access-guest-1234567890123456789","test-refresh-guest-123456789012345678",Duration.ofHours(24),Duration.ofDays(7));
    final BCryptPasswordEncoder encoder=new BCryptPasswordEncoder(4);
    UserEntity guest;
    @BeforeEach void setup(){guest=new UserEntity();guest.setId("aaaaaaaaaaaaaaaaaaaaaaaa");guest.setUsername("访客");guest.setEmail("test@guest.invalid");guest.setGuest(true);guest.setGuestExpiresAt(LocalDateTime.now(ZoneOffset.UTC).plusHours(24));when(users.lockById(guest.getId())).thenReturn(guest);when(users.selectById(guest.getId())).thenReturn(guest);}
    @AfterEach void cleanup(){SecurityContextHolder.clearContext();RequestContextHolder.resetRequestAttributes();}
    @Test void createsIndependentGuestWithPrivateExamplesAndNoRefreshToken(){
        var ids=new UserIdGenerator();var points=mock(KnowledgePointService.class);
        var service=new GuestService(users,ids,jwt,encoder,points,quota,settings);
        var a=service.create("127.0.0.2");var b=service.create("127.0.0.2");
        assertNotEquals(jwt.parseAccessToken(a.token()),jwt.parseAccessToken(b.token()));assertNull(a.refreshToken());
        verify(points,times(6)).create(anyString(),argThat(r->Boolean.FALSE.equals(r.isPublic())));
        verify(users,times(2)).insert(argThat(u->u.isGuest()&&u.getGuestExpiresAt().isAfter(LocalDateTime.now(ZoneOffset.UTC).plusHours(23))));
    }
    @Test void upgradePreservesIdAndRevokesGuestToken(){
        var service=new UserService(users,new UserIdGenerator(),encoder,jwt);
        var tokens=service.register(new RegisterRequest("正式昵称","new@example.invalid","new-password"),guest.getId());
        assertEquals(guest.getId(),jwt.parseAccessToken(tokens.token()));assertFalse(guest.isGuest());assertNull(guest.getGuestExpiresAt());assertEquals(1,guest.getAuthVersion());
        assertTrue(encoder.matches("new-password",guest.getPassword()));assertNotNull(tokens.refreshToken());
        verify(users,never()).insert(any(UserEntity.class));verify(users,never()).deleteKnowledge(anyString());verify(users).updateById(guest);
    }
    @Test void expiredGuestCannotUpgradeOrAuthenticate()throws Exception{
        guest.setGuestExpiresAt(LocalDateTime.now(ZoneOffset.UTC).minusSeconds(1));
        var service=new UserService(users,new UserIdGenerator(),encoder,jwt);
        assertThrows(ApiException.class,()->service.register(new RegisterRequest("正式昵称","new@example.invalid","new-password"),guest.getId()));
        var request=new MockHttpServletRequest();request.addHeader("Authorization","Bearer "+jwt.createAccessToken(guest.getId(),0));
        new JwtAuthenticationFilter(jwt,users).doFilter(request,new MockHttpServletResponse(),new MockFilterChain());
        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
    @Test void guestDoesNotReceiveRenewableRefreshSession(){
        var service=new UserService(users,new UserIdGenerator(),encoder,jwt);
        assertThrows(ApiException.class,()->service.refresh(jwt.createRefreshToken(guest.getId(),0)));
        assertNull(UserResponse.from(guest).email());assertTrue(UserResponse.from(guest).guest());
    }
    @Test void restrictsPaidUploadsAndProfileWritesButAllowsUpgradeAndLearning(){
        var interceptor=new GuestAccessInterceptor(quota,settings);
        for(String path:new String[]{"/api/audio/transcribe","/api/knowledge-points/import","/api/ai/rebuild-vector-store","/api/ai/generate-embeddings","/api/users/me/password"}){
            var request=request(path);assertThrows(ApiException.class,()->interceptor.preHandle(request,new MockHttpServletResponse(),new Object()));
        }
        assertTrue(interceptor.preHandle(request("/api/users/register"),new MockHttpServletResponse(),new Object()));
        assertTrue(interceptor.preHandle(request("/api/knowledge-points"),new MockHttpServletResponse(),new Object()));
        assertTrue(interceptor.preHandle(request("/api/ai/rag-qa-stream"),new MockHttpServletResponse(),new Object()));
        verify(quota).reserveAi(eq(guest.getId()),any());
    }
    @Test void formalUsersDoNotConsumeTrialQuota(){
        guest.setGuest(false);assertTrue(new GuestAccessInterceptor(quota,settings).preHandle(request("/api/audio/transcribe"),new MockHttpServletResponse(),new Object()));
        verifyNoInteractions(quota);
    }
    @Test void inputSizeAndProviderCallCapsAreEnforced(){
        var request=request("/api/ai/rag-qa");request.setContent(new byte[17000]);
        assertThrows(ApiException.class,()->new GuestAccessInterceptor(quota,settings).preHandle(request,new MockHttpServletResponse(),new Object()));
        verifyNoInteractions(quota);
        request.setAttribute("feynman.guest",true);RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        assertEquals(8000,GuestExecution.prompt("x".repeat(20000)).length());GuestExecution.prompt("test");
        assertThrows(ApiException.class,()->GuestExecution.prompt("third"));
    }
    @Test void refusesForgedForwardedIpFromDirectClientsAndUsesLastProxyHop(){
        var request=new MockHttpServletRequest();request.setRemoteAddr("203.0.113.5");request.addHeader("X-Forwarded-For","1.2.3.4");
        assertEquals("203.0.113.5",GuestClientAddress.from(request));
        request.setRemoteAddr("127.0.0.1");request.removeHeader("X-Forwarded-For");request.addHeader("X-Forwarded-For","1.2.3.4, 203.0.113.5");
        assertEquals("203.0.113.5",GuestClientAddress.from(request));
    }
    @Test void cleanupDoesNotDeleteUpgradedOrUnexpiredAccounts(){
        @SuppressWarnings("unchecked") ObjectProvider<GuestCleanup> self=mock(ObjectProvider.class);
        var cleanup=new GuestCleanup(users,mock(GuestUsageMapper.class),self);
        cleanup.deleteExpired(guest.getId(),LocalDateTime.now(ZoneOffset.UTC));verify(users,never()).deleteById(anyString());
        guest.setGuest(false);guest.setGuestExpiresAt(LocalDateTime.now(ZoneOffset.UTC).minusDays(1));cleanup.deleteExpired(guest.getId(),LocalDateTime.now(ZoneOffset.UTC));verify(users,never()).deleteById(anyString());
        guest.setGuest(true);cleanup.deleteExpired(guest.getId(),LocalDateTime.now(ZoneOffset.UTC));verify(users).deleteKnowledge(guest.getId());verify(users).deleteById(guest.getId());
    }
    @Test void guestKnowledgeLimitsAndOwnershipAreChecked(){
        var mapper=mock(KnowledgePointMapper.class);var service=new KnowledgePointService(mapper,mock(KnowledgePointTagMapper.class),new UserIdGenerator(),users);
        when(mapper.selectCount(any())).thenReturn(5L);
        assertThrows(ApiException.class,()->service.create(guest.getId(),new CreateKnowledgePointRequest("新知识","正文",null,null,null,null,false)));
        assertThrows(ApiException.class,()->service.update(guest.getId(),"point",new UpdateKnowledgePointRequest(null,"x".repeat(3001),null,null,null,null,null,null)));
        var point=new KnowledgePointEntity();point.setId("point");point.setAuthorId("somebody-else");when(mapper.selectById("point")).thenReturn(point);
        assertThrows(ApiException.class,()->service.get(guest.getId(),"point"));
    }
    MockHttpServletRequest request(String path){var request=new MockHttpServletRequest("POST",path);request.setContent("{}".getBytes());request.setAttribute("feynman.authenticatedUser",guest);request.setRemoteAddr("203.0.113.9");return request;}
}
