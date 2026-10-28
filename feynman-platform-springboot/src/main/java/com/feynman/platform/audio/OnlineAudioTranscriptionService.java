package com.feynman.platform.audio;

import com.feynman.platform.common.ApiException;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class OnlineAudioTranscriptionService {
    private static final long MAX_BYTES = 10L * 1024 * 1024;
    private final BaiduSpeechClient speechClient;

    public OnlineAudioTranscriptionService(BaiduSpeechClient speechClient) {
        this.speechClient = speechClient;
    }

    public AudioTranscriptionResponse transcribe(MultipartFile audio) {
        if (audio == null || audio.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AUDIO_REQUIRED", "未收到音频文件");
        }
        if (audio.getSize() > MAX_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "AUDIO_TOO_LARGE", "音频文件不能超过10MB");
        }
        try {
            byte[] bytes = audio.getBytes();
            requireWav(bytes);
            String text = speechClient.transcribeWav(bytes);
            return new AudioTranscriptionResponse(true, text, text, "baidu");
        } catch (ApiException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "AUDIO_READ_FAILED", "无法读取音频文件");
        }
    }

    private void requireWav(byte[] bytes) {
        boolean riff = bytes.length >= 12
                && bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'A' && bytes[10] == 'V' && bytes[11] == 'E';
        if (!riff) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "WAV_REQUIRED", "请上传 WAV 格式录音");
        }
    }
}
