package com.feynman.platform.rag;

import com.feynman.platform.security.CurrentUser;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

@ControllerAdvice
public class RagRebuildEmbeddingAdvice implements ResponseBodyAdvice<Object> {
    private final RagEmbeddingIndexService embeddingIndexService;

    public RagRebuildEmbeddingAdvice(RagEmbeddingIndexService embeddingIndexService) {
        this.embeddingIndexService = embeddingIndexService;
    }

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return returnType.getParameterType() == RagRebuildResponse.class;
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
        if (!(body instanceof RagRebuildResponse rebuild) || rebuild.chunks() == 0) return body;
        String userId = CurrentUser.id(SecurityContextHolder.getContext().getAuthentication());
        RagEmbeddingResponse generated = embeddingIndexService.generatePending(userId);
        String message = generated.failed() == 0 ? "向量库重建完成" : "向量库部分重建失败";
        String status = generated.failed() == 0 ? "ready" : "partial_failure";
        return new RagRebuildResponse(message, rebuild.count(), rebuild.chunks(), status);
    }
}
