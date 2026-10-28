package com.feynman.platform;

import com.feynman.platform.rag.RagChunkMapper;
import org.mockito.Mockito;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RagChunkMapperTestConfig {
    @Bean
    @ConditionalOnMissingBean(RagChunkMapper.class)
    RagChunkMapper testRagChunkMapper() {
        return Mockito.mock(RagChunkMapper.class);
    }
}
