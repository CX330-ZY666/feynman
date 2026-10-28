package com.feynman.platform.practice;

import com.feynman.platform.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/feynman-practice")
public class FeynmanPracticeController {
    private final FeynmanPracticeService service;

    public FeynmanPracticeController(FeynmanPracticeService service) {
        this.service = service;
    }

    @PostMapping("/save-weak-point")
    public WeakPointListResponse saveWeakPoint(
            Authentication authentication,
            @Valid @RequestBody SaveWeakPointRequest request
    ) {
        return service.saveWeakPoint(CurrentUser.id(authentication), request);
    }

    @PutMapping("/resolve-weak-point")
    public WeakPointUpdateResponse resolveWeakPoint(
            Authentication authentication,
            @Valid @RequestBody ResolveWeakPointRequest request
    ) {
        return service.toggleResolved(CurrentUser.id(authentication), request);
    }

    @PostMapping("/summary")
    public PracticeSummaryResponse summary(
            Authentication authentication,
            @Valid @RequestBody PracticeSummaryRequest request
    ) {
        return service.summarize(CurrentUser.id(authentication), request);
    }
}
