package com.feynman.platform.rag;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RagEmbeddingIndexService {
    private final RagChunkMapper chunkMapper;
    private final LocalOnnxEmbeddingService embeddingService;
    private final EmbeddingCodec codec;

    public RagEmbeddingIndexService(
            RagChunkMapper chunkMapper,
            LocalOnnxEmbeddingService embeddingService,
            EmbeddingCodec codec
    ) {
        this.chunkMapper = chunkMapper;
        this.embeddingService = embeddingService;
        this.codec = codec;
    }

    @Transactional
    public RagEmbeddingResponse generatePending(String userId) {
        List<RagChunkEntity> pending = chunkMapper.selectList(new LambdaQueryWrapper<RagChunkEntity>()
                .eq(RagChunkEntity::getAuthorId, userId)
                .eq(RagChunkEntity::getEmbeddingStatus, "pending")
                .orderByAsc(RagChunkEntity::getCreatedAt));
        int ready = 0;
        int failed = 0;
        for (RagChunkEntity chunk : pending) {
            try {
                float[] vector = embeddingService.embedPassage(chunk.getContent());
                chunk.setEmbedding(codec.encode(vector));
                chunk.setEmbeddingDimensions(vector.length);
                chunk.setEmbeddingModel(LocalOnnxEmbeddingService.MODEL_NAME);
                chunk.setEmbeddingStatus("ready");
                ready++;
            } catch (RuntimeException exception) {
                chunk.setEmbeddingStatus("failed");
                failed++;
            }
            chunk.setUpdatedAt(LocalDateTime.now());
            chunkMapper.updateById(chunk);
        }
        return new RagEmbeddingResponse(
                pending.size(), ready, failed,
                LocalOnnxEmbeddingService.MODEL_NAME, LocalOnnxEmbeddingService.DIMENSIONS);
    }

    public RagSearchResponse search(String userId, RagSearchRequest request) {
        float[] query = embeddingService.embedQuery(request.question().trim());
        List<RagSearchResult> results = chunkMapper.selectList(new LambdaQueryWrapper<RagChunkEntity>()
                        .eq(RagChunkEntity::getAuthorId, userId)
                        .eq(RagChunkEntity::getEmbeddingStatus, "ready"))
                .stream()
                .filter(chunk -> chunk.getEmbedding() != null)
                .map(chunk -> toResult(chunk, query))
                .sorted(Comparator.comparingDouble(RagSearchResult::score).reversed())
                .limit(request.effectiveTopK())
                .toList();
        return new RagSearchResponse(results);
    }

    private RagSearchResult toResult(RagChunkEntity chunk, float[] query) {
        float[] passage = codec.decode(chunk.getEmbedding());
        double score = 0;
        int length = Math.min(query.length, passage.length);
        for (int index = 0; index < length; index++) score += query[index] * passage[index];
        return new RagSearchResult(
                chunk.getContent(),
                Map.of(
                        "knowledgePointId", chunk.getKnowledgePointId(),
                        "title", chunk.getTitle(),
                        "chunkIndex", chunk.getChunkIndex()
                ),
                score
        );
    }
}
