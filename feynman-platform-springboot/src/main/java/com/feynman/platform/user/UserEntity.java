package com.feynman.platform.user;

import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("users")
public class UserEntity {
    private String id;
    private String username;
    private String email;
    private String password;
    private int authVersion;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
