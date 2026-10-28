package com.feynman.platform.rag;

import com.feynman.platform.security.CurrentUser;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
public class RagIndexController {
    private final RagIndexService service;

    public RagIndexController(RagIndexService service) {
        this.service = service;
    }

    @PostMapping("/rebuild-vector-store")
    public RagRebuildResponse rebuild(Authentication authentication) {
        return service.rebuild(CurrentUser.id(authentication));
    }

    @GetMapping("/rag-index-status")
    public RagIndexStatusResponse status(Authentication authentication) {
        return service.status(CurrentUser.id(authentication));
    }
}
