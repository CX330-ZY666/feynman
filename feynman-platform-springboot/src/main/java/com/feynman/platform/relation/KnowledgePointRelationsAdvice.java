package com.feynman.platform.relation;

import com.feynman.platform.knowledge.KnowledgePointListResponse;
import java.util.ArrayList;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

@ControllerAdvice
public class KnowledgePointRelationsAdvice implements ResponseBodyAdvice<Object> {
    private final KnowledgeRelationService relationService;

    public KnowledgePointRelationsAdvice(KnowledgeRelationService relationService) {
        this.relationService = relationService;
    }

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return KnowledgePointListResponse.class.isAssignableFrom(returnType.getParameterType());
    }

    @Override
    public Object beforeBodyWrite(
            Object body,
            MethodParameter returnType,
            MediaType selectedContentType,
            Class<? extends HttpMessageConverter<?>> selectedConverterType,
            ServerHttpRequest request,
            ServerHttpResponse response
    ) {
        if (!(body instanceof KnowledgePointListResponse listResponse)) return body;
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) return body;
        return new KnowledgePointListResponse(
                listResponse.knowledgePoints(),
                new ArrayList<>(relationService.list(authentication.getName()))
        );
    }
}
