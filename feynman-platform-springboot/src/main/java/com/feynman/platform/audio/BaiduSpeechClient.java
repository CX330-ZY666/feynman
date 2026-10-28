package com.feynman.platform.audio;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.feynman.platform.common.ApiException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class BaiduSpeechClient {
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String secretKey;
    private volatile String accessToken;
    private volatile Instant expiresAt = Instant.EPOCH;

    public BaiduSpeechClient(
            ObjectMapper objectMapper,
            @Value("${speech.baidu.api-key:${BAIDU_API_KEY:}}") String apiKey,
            @Value("${speech.baidu.secret-key:${BAIDU_SECRET_KEY:}}") String secretKey
    ) {
        this.objectMapper = objectMapper;
        this.apiKey = clean(apiKey);
        this.secretKey = clean(secretKey);
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    }

    public String transcribeWav(byte[] audio) {
        requireConfigured();
        try {
            Map<String, Object> payload = Map.of(
                    "format", "wav",
                    "rate", 16000,
                    "channel", 1,
                    "cuid", UUID.randomUUID().toString(),
                    "token", token(),
                    "dev_pid", 1537,
                    "speech", Base64.getEncoder().encodeToString(audio),
                    "len", audio.length
            );
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://vop.baidu.com/server_api"))
                    .timeout(Duration.ofSeconds(60))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) upstream();
            JsonNode json = objectMapper.readTree(response.body());
            int errorNumber = json.path("err_no").asInt(-1);
            if (errorNumber != 0) {
                String message = json.path("err_msg").asText("在线语音识别失败");
                throw new ApiException(HttpStatus.BAD_GATEWAY, "BAIDU_ASR_ERROR_" + errorNumber, message);
            }
            JsonNode result = json.path("result");
            if (!result.isArray() || result.isEmpty() || result.get(0).asText("").isBlank()) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "ASR_EMPTY_RESULT", "在线语音识别没有返回文字");
            }
            return result.get(0).asText().trim();
        } catch (ApiException exception) {
            throw exception;
        } catch (java.net.http.HttpTimeoutException exception) {
            throw new ApiException(HttpStatus.GATEWAY_TIMEOUT, "ASR_TIMEOUT", "在线语音识别超时，请重试");
        } catch (Exception exception) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "ASR_UPSTREAM_ERROR", "在线语音识别服务暂时不可用");
        }
    }

    private synchronized String token() throws Exception {
        if (accessToken != null && Instant.now().isBefore(expiresAt)) return accessToken;
        String query = "grant_type=client_credentials&client_id=" + encode(apiKey)
                + "&client_secret=" + encode(secretKey);
        HttpRequest request = HttpRequest.newBuilder(
                        URI.create("https://aip.baidubce.com/oauth/2.0/token?" + query))
                .timeout(Duration.ofSeconds(20))
                .POST(HttpRequest.BodyPublishers.noBody())
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode json = objectMapper.readTree(response.body());
        String token = json.path("access_token").asText("");
        if (token.isBlank()) upstream();
        long expiresIn = Math.max(300, json.path("expires_in").asLong(2592000));
        accessToken = token;
        expiresAt = Instant.now().plusSeconds(expiresIn - 120);
        return accessToken;
    }

    private void requireConfigured() {
        if (apiKey.isBlank() || secretKey.isBlank()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "BAIDU_ASR_NOT_CONFIGURED", "百度在线语音识别密钥尚未配置");
        }
    }

    private void upstream() {
        throw new ApiException(HttpStatus.BAD_GATEWAY, "BAIDU_ASR_UPSTREAM_ERROR", "百度在线语音识别服务返回错误");
    }

    private String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private String clean(String value) { return value == null ? "" : value.trim(); }
}
