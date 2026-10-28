package com.feynman.platform.knowledge;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("knowledge_points")
public class KnowledgePointEntity {
    private String id;
    private String title;
    private String content;
    private String category;
    private String authorId;
    private String difficulty;
    private Boolean isPublic;
    private Integer views;
    private String status;
    private Boolean reviewList;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
