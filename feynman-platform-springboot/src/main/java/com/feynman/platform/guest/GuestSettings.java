package com.feynman.platform.guest;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public record GuestSettings(
        @Value("${GUEST_ENABLED:true}") boolean enabled,
        @Value("${GUEST_AI_LIMIT:3}") int aiLimit,
        @Value("${GUEST_DAILY_AI_LIMIT:30}") int dailyAiLimit,
        @Value("${GUEST_IP_DAILY_SESSIONS:3}") int ipDailySessions,
        @Value("${GUEST_DAILY_SESSIONS:50}") int dailySessions) {}
