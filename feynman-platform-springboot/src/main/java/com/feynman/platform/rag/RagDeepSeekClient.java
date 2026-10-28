package com.feynman.platform.rag;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.feynman.platform.common.ApiException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class RagDeepSeekClient {
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final URI endpoint;
    private final String model;

    public RagDeepSeekClient(
            ObjectMapper objectMapper,
            @Value("${ai.deepseek.api-key:${DEEPSEEK_API_KEY:}}") String apiKey,
            @Value("${ai.deepseek.base-url:${DEEPSEEK_BASE_URL:https://api.deepseek.com}}") String baseUrl,
            @Value("${ai.deepseek.model:${DEEPSEEK_MODEL:deepseek-chat}}") String model
    ) {
        this.objectMapper = objectMapper;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.endpoint = URI.create(baseUrl.replaceAll("/+$", "") + "/chat/completions");
        this.model = model;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    public String answer(String prompt) {
        requireConfigured();
        try {
            HttpResponse<String> response = httpClient.send(
                    request(prompt, false), HttpResponse.BodyHandlers.ofString());
            requireSuccess(response.statusCode());
            JsonNode json = objectMapper.readTree(response.body());
            String answer = json.path("choices").path(0).path("message").path("content").asText("").trim();
            if (answer.isEmpty()) throw upstream("DeepSeek 返回了空答案");
            return answer;
        } catch (ApiException exception) {
            throw exception;
        } catch (java.net.http.HttpTimeoutException exception) {
            throw new ApiException(HttpStatus.GATEWAY_TIMEOUT, "AI_TIMEOUT", "AI 响应超时，请重试");
        } catch (Exception exception) {
            throw upstream("DeepSeek 服务暂时不可用");
        }
    }

    public void stream(String prompt, Consumer<String> chunkConsumer) {
        requireConfigured();
        try {
            HttpResponse<java.util.stream.Stream<String>> response = httpClient.send(
                    request(prompt, true), HttpResponse.BodyHandlers.ofLines());
            requireSuccess(response.statusCode());
            try (java.util.stream.Stream<String> lines = response.body()) {
                lines.forEach(line -> consumeLine(line, chunkConsumer));
            }
        } catch (ApiException exception) {
            throw exception;
        } catch (Exception exception) {
            throw upstream("DeepSeek 流式服务暂时不可用");
        }
    }

    private HttpRequest request(String prompt, boolean stream) throws Exception {
        Map<String, Object> body = Map.of(
                "model", model,
                "messages", List.of(Map.of("role", "user", "content", prompt)),
                "temperature", 0.3,
                "stream", stream
        );
        return HttpRequest.newBuilder(endpoint)
                .timeout(Duration.ofSeconds(60))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                .build();
    }

    private void consumeLine(String line, Consumer<String> consumer) {
        String trimmed = line.trim();
        if (!trimmed.startsWith("data:") || "data: [DONE]".equals(trimmed)) return;
        try {
            JsonNode json = objectMapper.readTree(trimmed.substring(5).trim());
            String content = json.path("choices").path(0).path("delta").path("content").asText("");
            if (!content.isEmpty()) consumer.accept(content);
        } catch (Exception ignored) {
            // A malformed upstream event is skipped; later valid events can still be delivered.
        }
    }

    private void requireConfigured() {
        if (apiKey.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "DEEPSEEK_NOT_CONFIGURED", "DeepSeek 密钥尚未配置");
        }
    }

    private void requireSuccess(int status) {
        if (status < 200 || status >= 300) throw upstream("DeepSeek 返回错误状态：" + status);
    }

    private ApiException upstream(String message) {
        return new ApiException(HttpStatus.BAD_GATEWAY, "AI_UPSTREAM_ERROR", message);
    }
}
