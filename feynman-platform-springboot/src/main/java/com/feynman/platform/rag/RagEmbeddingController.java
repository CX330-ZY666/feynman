package com.feynman.platform.rag;

import com.feynman.platform.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
public class RagEmbeddingController {
    private final RagEmbeddingIndexService service;

    public RagEmbeddingController(RagEmbeddingIndexService service) {
        this.service = service;
    }

    @PostMapping("/generate-embeddings")
    public RagEmbeddingResponse generate(Authentication authentication) {
        return service.generatePending(CurrentUser.id(authentication));
    }

    @PostMapping("/rag-search")
    public RagSearchResponse search(
            Authentication authentication,
            @Valid @RequestBody RagSearchRequest request
    ) {
        return service.search(CurrentUser.id(authentication), request);
    }
}
