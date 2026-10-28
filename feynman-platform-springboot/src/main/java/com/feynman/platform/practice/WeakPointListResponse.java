package com.feynman.platform.practice;

import java.util.List;

public record WeakPointListResponse(boolean success, List<WeakPointResponse> weakPoints) {
}
