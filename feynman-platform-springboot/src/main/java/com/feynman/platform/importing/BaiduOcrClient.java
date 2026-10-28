package com.feynman.platform.importing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.feynman.platform.common.ApiException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.Base64;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class BaiduOcrClient {
    private final ObjectMapper mapper;
    private final String apiKey;
    private final String secretKey;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private String accessToken;
    private Instant expires = Instant.EPOCH;

    public BaiduOcrClient(ObjectMapper mapper,
            @Value("${BAIDU_OCR_API_KEY:${BAIDU_API_KEY:}}") String apiKey,
            @Value("${BAIDU_OCR_SECRET_KEY:${BAIDU_SECRET_KEY:}}") String secretKey) {
        this.mapper = mapper; this.apiKey = apiKey.trim(); this.secretKey = secretKey.trim();
    }

    public boolean configured() { return !apiKey.isBlank() && !secretKey.isBlank(); }

    public String recognize(byte[] jpeg) {
        if (!configured()) throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "OCR_NOT_CONFIGURED", "图片识别尚未配置，请管理员配置百度OCR密钥；Word和文字型PDF仍可导入");
        try {
            String body = "image=" + encode(Base64.getEncoder().encodeToString(jpeg)) + "&detect_direction=true";
            var request = HttpRequest.newBuilder(URI.create("https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=" + token()))
                    .timeout(Duration.ofSeconds(35)).header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(body)).build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            var json = mapper.readTree(response.body());
            if (response.statusCode() != 200 || json.has("error_code")) {
                int code = json.path("error_code").asInt();
                String message = switch (code) {
                    case 6, 100, 110, 111 -> "OCR应用权限或密钥无效，请管理员检查是否已开通通用文字识别";
                    case 17, 18, 19 -> "OCR调用额度或频率已达上限，请稍后重试或检查百度控制台";
                    default -> "图片识别服务暂时不可用，请重试（服务代码 " + code + "）";
                };
                throw new ApiException(HttpStatus.BAD_GATEWAY, "OCR_UPSTREAM_" + code, message);
            }
            StringBuilder text = new StringBuilder();
            for (var line : json.path("words_result")) text.append(line.path("words").asText()).append('\n');
            return text.toString().trim();
        } catch (ApiException e) { throw e; }
        catch (HttpTimeoutException e) { throw new ApiException(HttpStatus.GATEWAY_TIMEOUT, "OCR_TIMEOUT", "图片识别超时，请重试"); }
        catch (Exception e) { throw new ApiException(HttpStatus.BAD_GATEWAY, "OCR_UNAVAILABLE", "无法连接图片识别服务，请稍后重试"); }
    }

    private synchronized String token() throws Exception {
        if (accessToken != null && Instant.now().isBefore(expires)) return accessToken;
        String body = "grant_type=client_credentials&client_id=" + encode(apiKey) + "&client_secret=" + encode(secretKey);
        var request = HttpRequest.newBuilder(URI.create("https://aip.baidubce.com/oauth/2.0/token"))
                .timeout(Duration.ofSeconds(15)).header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body)).build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofString());
        var json = mapper.readTree(response.body());
        accessToken = json.path("access_token").asText("");
        if (response.statusCode() != 200 || accessToken.isBlank()) throw new ApiException(HttpStatus.BAD_GATEWAY, "OCR_AUTH_FAILED", "OCR密钥验证失败，请管理员检查百度应用配置");
        expires = Instant.now().plusSeconds(Math.max(60, json.path("expires_in").asLong(3600) - 120));
        return accessToken;
    }

    private String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
}
