package com.feynman.platform.graph;

import com.feynman.platform.security.CurrentUser;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/graph")
public class KnowledgeGraphController {
    private final KnowledgeGraphService service;

    public KnowledgeGraphController(KnowledgeGraphService service) {
        this.service = service;
    }

    @GetMapping("/knowledge-map")
    public GraphResponse knowledgeMap(Authentication authentication) {
        return service.knowledgeMap(CurrentUser.id(authentication));
    }

    @GetMapping("/knowledge-universe")
    public GraphResponse knowledgeUniverse(Authentication authentication) {
        return service.knowledgeUniverse(CurrentUser.id(authentication));
    }
}
