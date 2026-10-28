package com.feynman.platform.rag;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import org.springframework.stereotype.Component;

@Component
public class EmbeddingCodec {
    public byte[] encode(float[] vector) {
        ByteBuffer buffer = ByteBuffer.allocate(vector.length * Float.BYTES).order(ByteOrder.LITTLE_ENDIAN);
        for (float value : vector) buffer.putFloat(value);
        return buffer.array();
    }

    public float[] decode(byte[] bytes) {
        if (bytes == null || bytes.length % Float.BYTES != 0) {
            throw new IllegalArgumentException("Invalid embedding bytes");
        }
        ByteBuffer buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        float[] vector = new float[bytes.length / Float.BYTES];
        for (int index = 0; index < vector.length; index++) vector[index] = buffer.getFloat();
        return vector;
    }
}
