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
@RequestMapping("/api/attempts")
public class AttemptController {
    private final FeynmanAttemptService service;

    public AttemptController(FeynmanAttemptService service) {
        this.service = service;
    }

    @PostMapping
    public AttemptResponse create(Authentication authentication, @Valid @RequestBody CreateAttemptRequest request) {
        return service.create(CurrentUser.id(authentication), request);
    }

    @GetMapping("/{knowledgePointId}")
    public List<AttemptResponse> list(Authentication authentication, @PathVariable String knowledgePointId) {
        return service.list(CurrentUser.id(authentication), knowledgePointId);
    }
}
