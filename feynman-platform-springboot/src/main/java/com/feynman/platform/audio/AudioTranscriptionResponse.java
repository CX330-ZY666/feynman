package com.feynman.platform.audio;

public record AudioTranscriptionResponse(boolean success, String text, String result, String provider) {
}
