package com.feynman.platform.audio;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/audio")
public class OnlineAudioController {
    private final OnlineAudioTranscriptionService service;

    public OnlineAudioController(OnlineAudioTranscriptionService service) { this.service = service; }

    @PostMapping(value = "/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AudioTranscriptionResponse transcribe(@RequestPart("audio") MultipartFile audio) {
        return service.transcribe(audio);
    }
}
