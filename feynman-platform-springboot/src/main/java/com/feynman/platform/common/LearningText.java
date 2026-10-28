package com.feynman.platform.common;

import org.springframework.web.util.HtmlUtils;

/** Learning and retrieval consume text, never embedded image data or HTML markup. */
public final class LearningText {
    private LearningText() {}
    public static String plain(String value) {
        if (value == null) return null;
        return HtmlUtils.htmlUnescape(value
                .replaceAll("(?is)<(script|style)\\b[^>]*>.*?</\\1>", "")
                .replaceAll("(?i)</?(p|div|h[1-6]|li|tr|blockquote)\\b[^>]*>|<br\\s*/?>", "\n")
                .replaceAll("<[^>]*>", ""))
                .replace('\u00a0', ' ').replaceAll("\n{3,}", "\n\n").trim();
    }
}
