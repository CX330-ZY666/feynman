package com.feynman.platform.guest;

import com.feynman.platform.common.ApiException;
import com.feynman.platform.user.UserEntity;
import jakarta.servlet.http.*;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class GuestAccessInterceptor implements HandlerInterceptor {
    private final GuestQuotaService quotas;private final GuestSettings settings;
    private static final Set<String> AI=Set.of("/api/ai/rag-qa","/api/ai/rag-qa-stream","/api/ai/evaluate-staged","/api/ai/follow-up-questions","/api/ai/compare-attempts","/api/ai/generate-question","/api/ai/explain-choice","/api/ai/grade-answer","/api/feynman-practice/ask","/api/feynman-practice/evaluate-understanding","/api/feynman-practice/summary");
    public GuestAccessInterceptor(GuestQuotaService quotas,GuestSettings settings){this.quotas=quotas;this.settings=settings;}
    @Override public boolean preHandle(HttpServletRequest request,HttpServletResponse response,Object handler) {
        if(!(request.getAttribute("feynman.authenticatedUser") instanceof UserEntity user)||!user.isGuest())return true;
        request.setAttribute("feynman.guest",true);
        String path=request.getRequestURI().substring(request.getContextPath().length());
        if(!settings.enabled() && !(path.equals("/api/users/register") || path.equals("/api/users/me") || path.equals("/api/users/guest/usage")))throw denied("免注册体验暂时关闭，请注册或登录正式账号");
        if("GET".equals(request.getMethod())||"OPTIONS".equals(request.getMethod()))return true;
        if(request.getContentLengthLong()>16_384)throw denied("体验模式仅支持短文本，请缩短内容，或注册正式账号");
        if(AI.contains(path)&&"POST".equals(request.getMethod())) {
            if(path.equals("/api/feynman-practice/summary")) {
                // This endpoint builds a local summary and never calls a model.
                quotas.reserveWrite(user.getId());
            } else if(path.equals("/api/feynman-practice/evaluate-understanding")) {
                quotas.reserveEvaluation(user.getId(),quotas.ipHash(GuestClientAddress.from(request)));
            } else {
                quotas.reserveAi(user.getId(),quotas.ipHash(GuestClientAddress.from(request)));
            }
            response.setHeader("X-Guest-AI-Remaining",String.valueOf(quotas.remaining(user.getId())));
            return true;
        }
        boolean learning=path.matches("/api/knowledge-points(?:/[0-9a-fA-F]{24}(?:/(?:status|review))?)?")
                ||path.matches("/api/relations(?:/[0-9a-fA-F]{24})?")
                ||path.startsWith("/api/feynman-attempts")||path.startsWith("/api/attempts")
                ||Set.of("/api/feynman-practice/save-weak-point","/api/feynman-practice/resolve-weak-point").contains(path);
        if(learning){quotas.reserveWrite(user.getId());return true;}
        if("POST".equals(request.getMethod())&&path.equals("/api/users/register"))return true;
        throw denied("体验模式不支持在线语音转写、文件导入、账号修改或手动重建索引，请注册后使用");
    }
    private ApiException denied(String message){return new ApiException(HttpStatus.FORBIDDEN,"GUEST_RESTRICTED",message);}
}
