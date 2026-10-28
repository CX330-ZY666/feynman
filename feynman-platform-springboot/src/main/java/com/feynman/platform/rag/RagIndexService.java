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
public class RagIndexService {
    private final KnowledgePointMapper knowledgePointMapper;
    private final RagChunkMapper chunkMapper;
    private final RagTextSplitter splitter;
    private final UserIdGenerator idGenerator;

    public RagIndexService(
            KnowledgePointMapper knowledgePointMapper,
            RagChunkMapper chunkMapper,
            RagTextSplitter splitter,
            UserIdGenerator idGenerator
    ) {
        this.knowledgePointMapper = knowledgePointMapper;
        this.chunkMapper = chunkMapper;
        this.splitter = splitter;
        this.idGenerator = idGenerator;
    }

    @Transactional
    public RagRebuildResponse rebuild(String userId) {
        List<KnowledgePointEntity> points = knowledgePointMapper.selectList(
                new LambdaQueryWrapper<KnowledgePointEntity>()
                        .eq(KnowledgePointEntity::getAuthorId, userId)
                        .orderByAsc(KnowledgePointEntity::getCreatedAt));
        chunkMapper.delete(new LambdaQueryWrapper<RagChunkEntity>().eq(RagChunkEntity::getAuthorId, userId));
        int chunkCount = 0;
        for (KnowledgePointEntity point : points) {
            List<String> chunks = splitter.split(point.getContent());
            for (int index = 0; index < chunks.size(); index++) {
                insertChunk(userId, point, index, chunks.get(index));
                chunkCount++;
            }
        }
        String message = points.isEmpty() ? "没有知识点需要索引" : "知识点分块已重建，等待生成向量";
        return new RagRebuildResponse(message, points.size(), chunkCount, "chunks_ready");
    }

    public RagIndexStatusResponse status(String userId) {
        long points = knowledgePointMapper.selectCount(
                new LambdaQueryWrapper<KnowledgePointEntity>().eq(KnowledgePointEntity::getAuthorId, userId));
        long chunks = count(userId, null);
        return new RagIndexStatusResponse(
                points, chunks, count(userId, "pending"), count(userId, "ready"), count(userId, "failed"));
    }

    private long count(String userId, String status) {
        LambdaQueryWrapper<RagChunkEntity> query = new LambdaQueryWrapper<RagChunkEntity>()
                .eq(RagChunkEntity::getAuthorId, userId);
        if (status != null) query.eq(RagChunkEntity::getEmbeddingStatus, status);
        return chunkMapper.selectCount(query);
    }

    private void insertChunk(String userId, KnowledgePointEntity point, int index, String content) {
        LocalDateTime now = LocalDateTime.now();
        RagChunkEntity entity = new RagChunkEntity();
        entity.setId(idGenerator.nextId());
        entity.setKnowledgePointId(point.getId());
        entity.setAuthorId(userId);
        entity.setChunkIndex(index);
        entity.setTitle(point.getTitle());
        entity.setContent(content);
        entity.setContentHash(sha256(content));
        entity.setEmbeddingStatus("pending");
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        chunkMapper.insert(entity);
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
