package com.feynman.platform;
import com.feynman.platform.guest.GuestUsageMapper;
import org.mockito.Mockito;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.*;
@Configuration public class GuestUsageMapperTestConfig {
    @Bean @ConditionalOnMissingBean(GuestUsageMapper.class)
    GuestUsageMapper testGuestUsageMapper(){return Mockito.mock(GuestUsageMapper.class);}
}
