package com.feynman.platform.guest;

import com.feynman.platform.security.CurrentUser;
import com.feynman.platform.user.TokenResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users/guest")
public class GuestController {
    private final GuestService service;private final GuestQuotaService quotas;
    public GuestController(GuestService service,GuestQuotaService quotas) {this.service=service;this.quotas=quotas;}
    @PostMapping public TokenResponse create(HttpServletRequest request) {return service.create(GuestClientAddress.from(request));}
    @GetMapping("/usage") public Map<String,Integer> usage(Authentication auth) {
        String id=CurrentUser.id(auth);
        return Map.of("remaining",quotas.remaining(id),"evaluationRemaining",quotas.evaluationRemaining(id));
    }
}
