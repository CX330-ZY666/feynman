package com.feynman.platform.rag;

import com.feynman.platform.knowledge.KnowledgePointResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

@ControllerAdvice
public class KnowledgePointAutoIndexAdvice implements ResponseBodyAdvice<Object> {
    private static final Logger log = LoggerFactory.getLogger(KnowledgePointAutoIndexAdvice.class);
    private final RagKnowledgePointSyncService syncService;

    public KnowledgePointAutoIndexAdvice(RagKnowledgePointSyncService syncService) {
        this.syncService = syncService;
    }

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return returnType.getParameterType() == KnowledgePointResponse.class;
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
        String method = request.getMethod().name();
        String path = request.getURI().getPath();
        if (!(body instanceof KnowledgePointResponse point)
                || !("POST".equals(method) || "PUT".equals(method))
                || !"/api/knowledge-points".equals(path) && !path.matches("/api/knowledge-points/[0-9a-fA-F]{24}")) {
            return body;
        }
        try {
            syncService.synchronize(point.author(), point.id());
        } catch (RuntimeException exception) {
            log.warn("RAG auto-index failed for knowledge point {}: {}", point.id(), exception.getMessage());
        }
        return body;
    }
}
