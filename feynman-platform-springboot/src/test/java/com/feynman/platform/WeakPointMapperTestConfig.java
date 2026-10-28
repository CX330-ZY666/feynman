package com.feynman.platform;

import com.feynman.platform.practice.WeakPointMapper;
import org.mockito.Mockito;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class WeakPointMapperTestConfig {
    @Bean
    @ConditionalOnMissingBean(WeakPointMapper.class)
    WeakPointMapper testWeakPointMapper() {
        return Mockito.mock(WeakPointMapper.class);
    }
}
