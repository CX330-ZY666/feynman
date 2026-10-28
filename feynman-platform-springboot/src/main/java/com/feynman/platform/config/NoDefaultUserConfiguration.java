package com.feynman.platform.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

@Configuration
public class NoDefaultUserConfiguration {
    @Bean
    UserDetailsService disabledFormLoginUserDetailsService() {
        return username -> {
            throw new UsernameNotFoundException("Form login is disabled; use JWT authentication");
        };
    }
}
