package com.feynman.platform.relation;

import com.feynman.platform.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/relations")
public class KnowledgeRelationController {
    private final KnowledgeRelationService service;

    public KnowledgeRelationController(KnowledgeRelationService service) {
        this.service = service;
    }

    @PostMapping
    public KnowledgeRelationResponse create(
            Authentication authentication,
            @Valid @RequestBody CreateRelationRequest request
    ) {
        return service.create(CurrentUser.id(authentication), request);
    }

    @GetMapping
    public List<KnowledgeRelationResponse> list(Authentication authentication) {
        return service.list(CurrentUser.id(authentication));
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(Authentication authentication, @PathVariable String id) {
        service.delete(CurrentUser.id(authentication), id);
        return Map.of("msg", "关系已删除");
    }
}
