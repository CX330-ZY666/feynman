package com.feynman.platform.practice;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("weak_points")
public class WeakPointEntity {
    private String id;
    private String knowledgePointId;
    private String authorId;
    private String content;
    private Boolean resolved;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
