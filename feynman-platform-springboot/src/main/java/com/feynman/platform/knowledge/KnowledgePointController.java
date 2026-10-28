package com.feynman.platform.knowledge;

import com.feynman.platform.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/knowledge-points")
public class KnowledgePointController {
    private final KnowledgePointService service;

    public KnowledgePointController(KnowledgePointService service) {
        this.service = service;
    }

    @PostMapping
    public KnowledgePointResponse create(Authentication authentication, @Valid @RequestBody CreateKnowledgePointRequest request) {
        return service.create(CurrentUser.id(authentication), request);
    }

    @GetMapping
    public KnowledgePointListResponse list(Authentication authentication) {
        return service.list(CurrentUser.id(authentication));
    }

    @GetMapping("/{id}")
    public KnowledgePointResponse get(Authentication authentication, @PathVariable String id) {
        return service.get(CurrentUser.id(authentication), id);
    }

    @PutMapping("/{id}")
    public KnowledgePointResponse update(
            Authentication authentication,
            @PathVariable String id,
            @Valid @RequestBody UpdateKnowledgePointRequest request
    ) {
        return service.update(CurrentUser.id(authentication), id, request);
    }

    @DeleteMapping("/{id}")
    public Map<String, String> delete(Authentication authentication, @PathVariable String id) {
        service.delete(CurrentUser.id(authentication), id);
        return Map.of("msg", "Knowledge point removed");
    }

    @PutMapping("/{id}/status")
    public KnowledgePointUpdateResponse updateStatus(
            Authentication authentication,
            @PathVariable String id,
            @Valid @RequestBody StatusRequest request
    ) {
        return service.updateStatus(CurrentUser.id(authentication), id, request.status());
    }

    @PutMapping("/{id}/review")
    public KnowledgePointUpdateResponse updateReview(
            Authentication authentication,
            @PathVariable String id,
            @Valid @RequestBody ReviewRequest request
    ) {
        return service.updateReview(CurrentUser.id(authentication), id, request.reviewList());
    }
}
