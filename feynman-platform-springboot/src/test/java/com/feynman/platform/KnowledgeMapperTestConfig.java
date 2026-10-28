package com.feynman.platform;

import com.feynman.platform.knowledge.KnowledgePointMapper;
import com.feynman.platform.knowledge.KnowledgePointTagMapper;
import org.mockito.Mockito;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class KnowledgeMapperTestConfig {
    @Bean
    @ConditionalOnMissingBean(KnowledgePointMapper.class)
    KnowledgePointMapper testKnowledgePointMapper() {
        return Mockito.mock(KnowledgePointMapper.class);
    }

    @Bean
    @ConditionalOnMissingBean(KnowledgePointTagMapper.class)
    KnowledgePointTagMapper testKnowledgePointTagMapper() {
        return Mockito.mock(KnowledgePointTagMapper.class);
    }
}
