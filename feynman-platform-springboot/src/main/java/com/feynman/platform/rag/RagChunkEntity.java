package com.feynman.platform.rag;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("rag_chunks")
public class RagChunkEntity {
    private String id;
    private String knowledgePointId;
    private String authorId;
    private Integer chunkIndex;
    private String title;
    private String content;
    private String contentHash;
    private byte[] embedding;
    private Integer embeddingDimensions;
    private String embeddingModel;
    private String embeddingStatus;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
