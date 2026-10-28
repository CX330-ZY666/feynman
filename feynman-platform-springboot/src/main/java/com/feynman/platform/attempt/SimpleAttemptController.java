package com.feynman.platform.attempt;

import com.feynman.platform.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/feynman-attempts")
public class SimpleAttemptController {
    private final FeynmanAttemptService service;

    public SimpleAttemptController(FeynmanAttemptService service) {
        this.service = service;
    }

    @PostMapping
    public SimpleAttemptResponse create(
            Authentication authentication,
            @Valid @RequestBody CreateSimpleAttemptRequest request
    ) {
        return service.createSimple(CurrentUser.id(authentication), request);
    }

    @GetMapping("/{knowledgePointId}")
    public List<SimpleAttemptResponse> list(Authentication authentication, @PathVariable String knowledgePointId) {
        return service.listSimple(CurrentUser.id(authentication), knowledgePointId);
    }
}
