package com.feynman.platform;

import com.feynman.platform.user.UserMapper;
import org.mockito.Mockito;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class UserMapperTestConfig {
    @Bean
    @ConditionalOnMissingBean(UserMapper.class)
    UserMapper testUserMapper() {
        return Mockito.mock(UserMapper.class);
    }
}
