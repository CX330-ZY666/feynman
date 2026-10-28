package com.feynman.platform.practice;

import com.feynman.platform.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/feynman-practice")
public class FeynmanAiPracticeController {
    private final FeynmanAiPracticeService service;

    public FeynmanAiPracticeController(FeynmanAiPracticeService service) {
        this.service = service;
    }

    @PostMapping("/ask")
    public AskQuestionResponse ask(Authentication authentication, @Valid @RequestBody AskQuestionRequest request) {
        return service.ask(CurrentUser.id(authentication), request);
    }

    @PostMapping("/evaluate-understanding")
    public UnderstandingEvaluationResponse evaluate(
            Authentication authentication,
            @Valid @RequestBody EvaluateUnderstandingRequest request
    ) {
        return service.evaluate(CurrentUser.id(authentication), request);
    }
}
