package com.feynman.platform.common;

import java.time.OffsetDateTime;

public record ErrorResponse(String msg, String code, OffsetDateTime timestamp) {
    public static ErrorResponse of(String msg, String code) {
        return new ErrorResponse(msg, code, OffsetDateTime.now());
    }
}
