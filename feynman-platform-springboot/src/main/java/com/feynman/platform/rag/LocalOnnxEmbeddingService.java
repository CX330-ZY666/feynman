package com.feynman.platform.rag;

import ai.djl.huggingface.tokenizers.Encoding;
import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import jakarta.annotation.PreDestroy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class LocalOnnxEmbeddingService {
    public static final String MODEL_NAME = "multilingual-e5-small";
    public static final int DIMENSIONS = 384;

    private final Path modelDirectory;
    private volatile OrtEnvironment environment;
    private volatile OrtSession session;
    private volatile HuggingFaceTokenizer tokenizer;

    public LocalOnnxEmbeddingService(
            @Value("${rag.model-path:${RAG_MODEL_PATH:models/multilingual-e5-small}}") String modelPath
    ) {
        this.modelDirectory = Path.of(modelPath).toAbsolutePath().normalize();
    }

    public float[] embedPassage(String text) {
        return embed("passage: " + text);
    }

    public float[] embedQuery(String text) {
        return embed("query: " + text);
    }

    public Path modelDirectory() {
        return modelDirectory;
    }

    private float[] embed(String text) {
        initializeIfNeeded();
        Encoding encoding = tokenizer.encode(text);
        long[] ids = encoding.getIds();
        long[] mask = encoding.getAttentionMask();
        long[] tokenTypes = encoding.getTypeIds();
        Map<String, OnnxTensor> inputs = new HashMap<>();
        try {
            inputs.put("input_ids", OnnxTensor.createTensor(environment, new long[][]{ids}));
            inputs.put("attention_mask", OnnxTensor.createTensor(environment, new long[][]{mask}));
            if (session.getInputNames().contains("token_type_ids")) {
                inputs.put("token_type_ids", OnnxTensor.createTensor(environment, new long[][]{tokenTypes}));
            }
            try (OrtSession.Result result = session.run(inputs)) {
                Object value = result.get(0).getValue();
                if (!(value instanceof float[][][] hiddenStates) || hiddenStates.length == 0) {
                    throw new IllegalStateException("ONNX model returned an unexpected output");
                }
                return meanPoolAndNormalize(hiddenStates[0], mask);
            }
        } catch (OrtException exception) {
            throw new IllegalStateException("ONNX embedding failed", exception);
        } finally {
            inputs.values().forEach(tensor -> {
                try { tensor.close(); } catch (Exception ignored) { }
            });
        }
    }

    private synchronized void initializeIfNeeded() {
        if (session != null) return;
        Path tokenizerFile = modelDirectory.resolve("tokenizer.json");
        Path modelFile = modelDirectory.resolve("onnx").resolve("model.onnx");
        if (!Files.isRegularFile(tokenizerFile) || !Files.isRegularFile(modelFile)) {
            throw new IllegalStateException("RAG model files are missing under " + modelDirectory);
        }
        try {
            environment = OrtEnvironment.getEnvironment();
            OrtSession.SessionOptions options = new OrtSession.SessionOptions();
            options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
            session = environment.createSession(modelFile.toString(), options);
            tokenizer = HuggingFaceTokenizer.newInstance(modelDirectory);
        } catch (Exception exception) {
            closeResources();
            throw new IllegalStateException("Cannot initialize local RAG model", exception);
        }
    }

    private float[] meanPoolAndNormalize(float[][] tokenVectors, long[] attentionMask) {
        if (tokenVectors.length == 0 || tokenVectors[0].length != DIMENSIONS) {
            throw new IllegalStateException("Unexpected embedding dimensions");
        }
        float[] pooled = new float[DIMENSIONS];
        long tokens = 0;
        for (int token = 0; token < tokenVectors.length && token < attentionMask.length; token++) {
            if (attentionMask[token] == 0) continue;
            tokens++;
            for (int dimension = 0; dimension < DIMENSIONS; dimension++) {
                pooled[dimension] += tokenVectors[token][dimension];
            }
        }
        if (tokens == 0) throw new IllegalStateException("Tokenizer produced no active tokens");
        double norm = 0;
        for (int dimension = 0; dimension < DIMENSIONS; dimension++) {
            pooled[dimension] /= tokens;
            norm += pooled[dimension] * pooled[dimension];
        }
        norm = Math.sqrt(norm);
        if (norm == 0) throw new IllegalStateException("Embedding norm is zero");
        for (int dimension = 0; dimension < DIMENSIONS; dimension++) pooled[dimension] /= (float) norm;
        return pooled;
    }

    @PreDestroy
    public synchronized void closeResources() {
        if (tokenizer != null) tokenizer.close();
        if (session != null) {
            try { session.close(); } catch (Exception ignored) { }
        }
        tokenizer = null;
        session = null;
    }
}
