package com.feynman.platform.rag;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class EmbeddingCodecTests {
    private final EmbeddingCodec codec = new EmbeddingCodec();

    @Test
    void roundTripsFloatVector() {
        float[] source = {0.25f, -0.5f, 1.0f};
        assertThat(codec.decode(codec.encode(source))).containsExactly(source);
    }
}
