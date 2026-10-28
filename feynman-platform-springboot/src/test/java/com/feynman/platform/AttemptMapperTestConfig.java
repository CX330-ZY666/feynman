package com.feynman.platform;

import com.feynman.platform.attempt.FeynmanAttemptMapper;
import org.mockito.Mockito;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AttemptMapperTestConfig {
    @Bean
    @ConditionalOnMissingBean(FeynmanAttemptMapper.class)
    FeynmanAttemptMapper testFeynmanAttemptMapper() {
        return Mockito.mock(FeynmanAttemptMapper.class);
    }
}
