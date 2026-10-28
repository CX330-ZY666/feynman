package com.feynman.platform.user;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface UserMapper extends BaseMapper<UserEntity> {
    @org.apache.ibatis.annotations.Select("SELECT * FROM users WHERE id = #{id} FOR UPDATE")
    UserEntity lockById(String id);
    @org.apache.ibatis.annotations.Delete("DELETE FROM feynman_attempts WHERE author_id = #{id} OR knowledge_point_id IN (SELECT id FROM knowledge_points WHERE author_id = #{id})")
    void deleteAttempts(String id);
    @org.apache.ibatis.annotations.Delete("DELETE FROM weak_points WHERE author_id = #{id}")
    void deleteWeakPoints(String id);
    @org.apache.ibatis.annotations.Delete("DELETE FROM knowledge_relations WHERE author_id = #{id}")
    void deleteRelations(String id);
    @org.apache.ibatis.annotations.Delete("DELETE FROM knowledge_points WHERE author_id = #{id}")
    void deleteKnowledge(String id);
}
