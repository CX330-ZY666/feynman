package com.feynman.platform.guest;

import org.apache.ibatis.annotations.*;
import java.time.LocalDateTime;

@Mapper
public interface GuestUsageMapper {
    @Insert("INSERT INTO guest_usage(bucket_key,used_count,expires_at) VALUES(#{key},0,#{expires}) ON DUPLICATE KEY UPDATE bucket_key=bucket_key")
    void ensure(@Param("key") String key, @Param("expires") LocalDateTime expires);
    @Update("UPDATE guest_usage SET used_count=used_count+1 WHERE bucket_key=#{key} AND used_count<#{limit}")
    int consume(@Param("key") String key,@Param("limit") int limit);
    @Select("SELECT used_count FROM guest_usage WHERE bucket_key=#{key}")
    Integer count(String key);
    @Delete("DELETE FROM guest_usage WHERE expires_at < #{now}")
    int deleteExpired(LocalDateTime now);
}
