package com.feynman.platform.rag;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.feynman.platform.knowledge.KnowledgePointEntity;
import com.feynman.platform.knowledge.KnowledgePointMapper;
import com.feynman.platform.user.UserIdGenerator;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RagKnowledgePointSyncService {
    private final KnowledgePointMapper knowledgePointMapper;
    private final RagChunkMapper chunkMapper;
    private final RagTextSplitter splitter;
    private final UserIdGenerator idGenerator;
    private final RagEmbeddingIndexService embeddingIndexService;

    public RagKnowledgePointSyncService(
            KnowledgePointMapper knowledgePointMapper,
            RagChunkMapper chunkMapper,
            RagTextSplitter splitter,
            UserIdGenerator idGenerator,
            RagEmbeddingIndexService embeddingIndexService
    ) {
        this.knowledgePointMapper = knowledgePointMapper;
        this.chunkMapper = chunkMapper;
        this.splitter = splitter;
        this.idGenerator = idGenerator;
        this.embeddingIndexService = embeddingIndexService;
    }

    @Transactional
    public int synchronize(String userId, String knowledgePointId) {
        KnowledgePointEntity point = knowledgePointMapper.selectById(knowledgePointId);
        if (point == null || !userId.equals(point.getAuthorId())) return 0;
        chunkMapper.delete(new LambdaQueryWrapper<RagChunkEntity>()
                .eq(RagChunkEntity::getKnowledgePointId, knowledgePointId)
                .eq(RagChunkEntity::getAuthorId, userId));
        List<String> contents = splitter.split(point.getContent());
        for (int index = 0; index < contents.size(); index++) {
            insertPendingChunk(point, userId, index, contents.get(index));
        }
        embeddingIndexService.generatePending(userId);
        return contents.size();
    }

    private void insertPendingChunk(KnowledgePointEntity point, String userId, int index, String content) {
        LocalDateTime now = LocalDateTime.now();
        RagChunkEntity chunk = new RagChunkEntity();
        chunk.setId(idGenerator.nextId());
        chunk.setKnowledgePointId(point.getId());
        chunk.setAuthorId(userId);
        chunk.setChunkIndex(index);
        chunk.setTitle(point.getTitle());
        chunk.setContent(content);
        chunk.setContentHash(sha256(content));
        chunk.setEmbeddingStatus("pending");
        chunk.setCreatedAt(now);
        chunk.setUpdatedAt(now);
        chunkMapper.insert(chunk);
    }

    private String sha256(String content) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(content.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot calculate content hash", exception);
        }
    }
}
