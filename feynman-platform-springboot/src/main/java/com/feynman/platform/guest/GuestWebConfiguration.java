package com.feynman.platform.guest;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class GuestWebConfiguration implements WebMvcConfigurer {
    private final GuestAccessInterceptor interceptor;
    public GuestWebConfiguration(GuestAccessInterceptor interceptor){this.interceptor=interceptor;}
    @Override public void addInterceptors(InterceptorRegistry registry){registry.addInterceptor(interceptor).addPathPatterns("/api/**");}
}
