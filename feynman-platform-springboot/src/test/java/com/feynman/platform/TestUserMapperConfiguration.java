package com.feynman.platform;

import com.feynman.platform.user.UserMapper;
import org.mockito.Mockito;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;

@TestConfiguration
public class TestUserMapperConfiguration {

    @Bean
    UserMapper userMapper() {
        return Mockito.mock(UserMapper.class);
    }
}
