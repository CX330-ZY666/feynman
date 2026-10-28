package com.feynman.platform.attempt;

import com.baomidou.mybatisplus.annotation.TableName;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("feynman_attempts")
public class FeynmanAttemptEntity {
    private String id;
    private String knowledgePointId;
    private String authorId;
    private String transcribedText;
    private String polishedText;
    private String standardAnswer;
    private BigDecimal score;
    private String feedback;
    private Long durationMs;
    private Long durationSeconds;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
