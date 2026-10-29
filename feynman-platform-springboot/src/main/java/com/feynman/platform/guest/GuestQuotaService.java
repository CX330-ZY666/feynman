package com.feynman.platform.guest;

import com.feynman.platform.common.ApiException;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class GuestQuotaService {
    private final GuestUsageMapper mapper;
    private final GuestSettings settings;
    private final String secret;
    public GuestQuotaService(GuestUsageMapper mapper,GuestSettings settings,@Value("${security.jwt.secret}") String secret) {
        this.mapper=mapper;this.settings=settings;this.secret=secret;
    }
    public String ipHash(String address) {
        try { var mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(("guest-ip:"+address).getBytes(StandardCharsets.UTF_8)));
        } catch(Exception e) {throw new IllegalStateException("Guest rate limiter unavailable");}
    }
    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public void reserveSession(String ipHash) {
        var now=LocalDateTime.now(ZoneOffset.UTC);
        use("create-minute:"+ipHash+":"+now.withSecond(0).withNano(0),3,now.plusDays(2));
        use("create-ip:"+ipHash+":"+now.toLocalDate(),settings.ipDailySessions(),now.plusDays(2));
        use("create-global:"+now.toLocalDate(),settings.dailySessions(),now.plusDays(2));
    }
    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public void reserveAi(String userId,String ipHash) {
        var now=LocalDateTime.now(ZoneOffset.UTC);
        use("ai-user:"+userId,settings.aiLimit(),now.plusDays(2));
        use("ai-ip:"+ipHash+":"+now.toLocalDate(),6,now.plusDays(2));
        use("ai-global:"+now.toLocalDate(),settings.dailyAiLimit(),now.plusDays(2));
    }
    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public void reserveEvaluation(String userId,String ipHash) {
        var now=LocalDateTime.now(ZoneOffset.UTC);
        use("evaluation-user:"+userId,1,now.plusDays(2));
        use("ai-ip:"+ipHash+":"+now.toLocalDate(),6,now.plusDays(2));
        use("ai-global:"+now.toLocalDate(),settings.dailyAiLimit(),now.plusDays(2));
    }
    public int evaluationRemaining(String userId) {
        Integer used=mapper.count("evaluation-user:"+userId);
        return Math.max(0,1-(used==null?0:used));
    }
    @Transactional(propagation=Propagation.REQUIRES_NEW)
    public void reserveWrite(String userId) {
        var now=LocalDateTime.now(ZoneOffset.UTC);
        use("write-user:"+userId+":"+now.toLocalDate(),100,now.plusDays(2));
    }
    public int remaining(String userId) {
        Integer used=mapper.count("ai-user:"+userId);
        return Math.max(0,settings.aiLimit()-(used==null?0:used));
    }
    private void use(String key,int limit,LocalDateTime expiry) {
        mapper.ensure(key,expiry);
        if(mapper.consume(key,Math.max(0,limit))!=1) throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,"GUEST_QUOTA_EXCEEDED","体验额度或创建频率已达上限，请稍后再试，或注册/登录正式账号");
    }
}
