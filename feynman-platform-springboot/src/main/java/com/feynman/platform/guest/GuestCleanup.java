package com.feynman.platform.guest;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.feynman.platform.user.*;
import java.time.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GuestCleanup {
    private final UserMapper users;private final GuestUsageMapper usage;private final ObjectProvider<GuestCleanup> self;
    public GuestCleanup(UserMapper users,GuestUsageMapper usage,ObjectProvider<GuestCleanup> self){this.users=users;this.usage=usage;this.self=self;}
    @Scheduled(initialDelay=300000,fixedDelay=3600000)
    public void cleanup() {
        var now=LocalDateTime.now(ZoneOffset.UTC);
        var expired=users.selectList(new LambdaQueryWrapper<UserEntity>().eq(UserEntity::isGuest,true).le(UserEntity::getGuestExpiresAt,now).last("LIMIT 50"));
        for(var user:expired)self.getObject().deleteExpired(user.getId(),now);
        usage.deleteExpired(LocalDateTime.now(ZoneOffset.UTC));
    }
    @Transactional public void deleteExpired(String id,LocalDateTime now) {
        var user=users.lockById(id);
        if(user==null||!user.isGuest()||user.getGuestExpiresAt()==null||user.getGuestExpiresAt().isAfter(now))return;
        users.deleteAttempts(id);users.deleteWeakPoints(id);users.deleteRelations(id);users.deleteKnowledge(id);users.deleteById(id);
    }
    @Configuration @EnableScheduling static class Scheduling {}
}
