package com.feynman.platform;

import com.feynman.platform.relation.KnowledgeRelationMapper;
import org.mockito.Mockito;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RelationMapperTestConfig {
    @Bean
    @ConditionalOnMissingBean(KnowledgeRelationMapper.class)
    KnowledgeRelationMapper testKnowledgeRelationMapper() {
        return Mockito.mock(KnowledgeRelationMapper.class);
    }
}
