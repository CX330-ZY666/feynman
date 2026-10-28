package com.feynman.platform.knowledge;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("knowledge_point_tags")
public class KnowledgePointTagEntity {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String knowledgePointId;
    private String tag;
}
