package com.feynman.platform.rag;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.feynman.platform.security.CurrentUser;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
public class RagQaController {
    private final RagQaService service;
    private final RagDeepSeekClient deepSeekClient;
    private final ObjectMapper objectMapper;

    public RagQaController(RagQaService service, RagDeepSeekClient deepSeekClient, ObjectMapper objectMapper) {
        this.service = service;
        this.deepSeekClient = deepSeekClient;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/rag-qa")
    public RagQaResponse answer(
            Authentication authentication,
            @Valid @RequestBody RagSearchRequest request
    ) {
        return service.answer(CurrentUser.id(authentication), request);
    }

    @PostMapping(value = "/rag-qa-stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public void stream(
            Authentication authentication,
            @Valid @RequestBody RagSearchRequest request,
            HttpServletResponse response
    ) throws IOException {
        RagPreparedQuestion prepared = service.prepare(CurrentUser.id(authentication), request);
        response.setStatus(HttpServletResponse.SC_OK);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.TEXT_EVENT_STREAM_VALUE);
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("X-Accel-Buffering", "no");
        try {
            if (prepared.needsAi()) {
                deepSeekClient.stream(prepared.prompt(), chunk -> writeEvent(response, Map.of("chunk", chunk)));
            } else {
                writeEvent(response, Map.of("chunk", prepared.directAnswer()));
            }
            writeEvent(response, Map.of("type", "sources", "sources", prepared.sources()));
        } catch (RuntimeException exception) {
            writeEvent(response, Map.of("error", "RAG_STREAM_ERROR", "msg", exception.getMessage()));
        } finally {
            response.getWriter().write("data: [DONE]\n\n");
            response.getWriter().flush();
        }
    }

    private void writeEvent(HttpServletResponse response, Object payload) {
        try {
            response.getWriter().write("data: " + objectMapper.writeValueAsString(payload) + "\n\n");
            response.getWriter().flush();
        } catch (IOException exception) {
            throw new IllegalStateException("客户端已断开连接", exception);
        }
    }
}
