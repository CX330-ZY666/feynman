package com.feynman.platform.relation;

import com.baomidou.mybatisplus.annotation.TableName;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("knowledge_relations")
public class KnowledgeRelationEntity {
    private String id;
    private String sourceId;
    private String targetId;
    private String authorId;
    private String type;
    private String relationType;
    private BigDecimal strength;
    private String relationLabel;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
