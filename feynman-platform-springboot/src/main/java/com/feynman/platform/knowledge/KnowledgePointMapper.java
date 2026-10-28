package com.feynman.platform.knowledge;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface KnowledgePointMapper extends BaseMapper<KnowledgePointEntity> {
    @Delete("DELETE FROM feynman_attempts WHERE knowledge_point_id = #{knowledgePointId}")
    int deleteAttempts(String knowledgePointId);
}
