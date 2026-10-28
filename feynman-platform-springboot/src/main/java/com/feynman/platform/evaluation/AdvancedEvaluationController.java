package com.feynman.platform.evaluation;

import com.fasterxml.jackson.databind.JsonNode;
import com.feynman.platform.security.CurrentUser;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
public class AdvancedEvaluationController {
    private final AdvancedEvaluationService service;

    public AdvancedEvaluationController(AdvancedEvaluationService service) { this.service = service; }

    @PostMapping("/evaluate-staged")
    public Map<String, Object> evaluate(Authentication auth, @Valid @RequestBody EvaluateStagedRequest request) {
        return service.evaluate(CurrentUser.id(auth), request);
    }

    @PostMapping("/follow-up-questions")
    public JsonNode followUp(@Valid @RequestBody FollowUpQuestionsRequest request) { return service.followUp(request); }

    @PostMapping("/compare-attempts")
    public Map<String, Object> compare(Authentication auth, @Valid @RequestBody CompareAttemptsRequest request) {
        return service.compare(CurrentUser.id(auth), request);
    }
}
