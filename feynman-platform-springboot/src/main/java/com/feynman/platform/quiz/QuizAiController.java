package com.feynman.platform.quiz;

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
public class QuizAiController {
    private final QuizAiService service;

    public QuizAiController(QuizAiService service) {
        this.service = service;
    }

    @PostMapping("/generate-question")
    public Map<String, Object> generate(@Valid @RequestBody GenerateQuestionRequest request) {
        return service.generate(request);
    }

    @PostMapping("/explain-choice")
    public ChoiceExplanationResponse explain(@Valid @RequestBody ExplainChoiceRequest request) {
        return service.explain(request);
    }

    @PostMapping("/grade-answer")
    public GradeAnswerResponse grade(
            Authentication authentication,
            @Valid @RequestBody GradeAnswerRequest request
    ) {
        return service.grade(CurrentUser.id(authentication), request);
    }
}
