package com.feynman.platform.guest;

import com.feynman.platform.common.ApiException;
import com.feynman.platform.knowledge.*;
import com.feynman.platform.security.JwtService;
import com.feynman.platform.user.*;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GuestService {
    private final UserMapper users; private final UserIdGenerator ids; private final JwtService jwt;
    private final PasswordEncoder encoder;private final KnowledgePointService points;
    private final GuestQuotaService quotas;private final GuestSettings settings;
    public GuestService(UserMapper users,UserIdGenerator ids,JwtService jwt,PasswordEncoder encoder,KnowledgePointService points,GuestQuotaService quotas,GuestSettings settings) {
        this.users=users;this.ids=ids;this.jwt=jwt;this.encoder=encoder;this.points=points;this.quotas=quotas;this.settings=settings;
    }
    @Transactional
    public TokenResponse create(String address) {
        if(!settings.enabled()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,"GUEST_DISABLED","免注册体验暂未开放，请使用正式账号登录");
        quotas.reserveSession(quotas.ipHash(address));
        String id=ids.nextId();var now=LocalDateTime.now();
        var user=new UserEntity();user.setId(id);user.setUsername("体验者_"+id);user.setEmail(id+"@guest.invalid");
        user.setPassword(encoder.encode(ids.nextId()+ids.nextId()));user.setGuest(true);user.setGuestExpiresAt(LocalDateTime.now(java.time.ZoneOffset.UTC).plusHours(24));
        user.setCreatedAt(now);user.setUpdatedAt(now);users.insert(user);
        seed(id,"费曼学习法：把知识讲给别人听","<p>费曼学习法的关键不是背诵，而是用自己的话把知识解释清楚。</p><p>可以分四步：选择一个概念；假设听众没有相关基础，用简单语言解释；发现卡住的地方后回到资料补充；再次组织语言，并用例子检查理解。</p><p>试着点击“开始复述”，用文字讲一遍。体验模式不提供在线语音转写。</p>");
        seed(id,"间隔重复：为什么要分多次复习","<p>把复习分散到不同时间，通常比临时集中重复更有利于长期记忆。第一次学完后及时回忆，再逐渐拉长复习间隔。</p><p>重点不是反复阅读，而是合上资料主动想一遍；回忆不出来的部分再重点补充。具体间隔应根据难度和遗忘情况调整。</p>");
        seed(id,"主动回忆：先尝试，再看答案","<p>主动回忆是先不看资料，尝试说出或写出学过的内容，再对照答案找出遗漏。阅读让内容看起来熟悉，但熟悉不一定意味着能独立运用。</p><p>可以尝试自测、口头复述或向别人解释。把答错的原因记下来，再安排后续复习。</p>");
        return TokenResponse.accessOnly(jwt.createAccessToken(id,0));
    }
    private void seed(String id,String title,String content) {
        points.create(id,new CreateKnowledgePointRequest(title,content,"学习方法",List.of("体验示例"),"learning","beginner",false));
    }
}
