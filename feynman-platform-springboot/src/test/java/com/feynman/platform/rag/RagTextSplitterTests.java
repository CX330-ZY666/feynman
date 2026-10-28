package com.feynman.platform.rag;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class RagTextSplitterTests {
    private final RagTextSplitter splitter = new RagTextSplitter();

    @Test
    void returnsEmptyListForBlankText() {
        assertThat(splitter.split("  ")).isEmpty();
    }

    @Test
    void keepsShortTextAsOneChunk() {
        assertThat(splitter.split("费曼学习法强调用自己的话解释。"))
                .containsExactly("费曼学习法强调用自己的话解释。");
    }

    @Test
    void splitsLongTextWithOverlapAndSizeLimit() {
        String text = "知识点内容。".repeat(120);
        List<String> chunks = splitter.split(text);
        assertThat(chunks).hasSizeGreaterThan(1);
        assertThat(chunks).allMatch(chunk -> chunk.length() <= RagTextSplitter.CHUNK_SIZE);
        assertThat(chunks.get(1))
                .contains(chunks.get(0).substring(chunks.get(0).length() - 20));
    }
}
