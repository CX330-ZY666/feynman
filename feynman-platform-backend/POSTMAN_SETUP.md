# Postman API 测试配置指南

## 🔐 安全配置

### 1. 创建环境变量

在 Postman 中创建名为 "Feynman Platform" 的环境，包含以下变量：

| 变量名 | 初始值 | 当前值 | 描述 |
|--------|--------|--------|------|
| `base_url` | `http://localhost:3000` | `http://localhost:3000` | API 基础 URL |
| `auth_token` | (空) | (空) | JWT 认证令牌 |

### 2. API 测试流程

#### 步骤 1: 用户注册 (可选)
```http
POST {{base_url}}/api/users/register
Content-Type: application/json

{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
}
```

#### 步骤 2: 用户登录获取 Token
```http
POST {{base_url}}/api/users/login
Content-Type: application/json

{
    "email": "test@example.com",
    "password": "password123"
}
```

**在 Tests 标签页添加自动保存 Token 的代码：**
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    if (response.token) {
        pm.environment.set("auth_token", response.token);
        console.log("✅ Token saved to environment variable");
    }
} else {
    console.log("❌ Login failed:", pm.response.text());
}
```

#### 步骤 3: 创建知识点
```http
POST {{base_url}}/api/knowledge-points
Authorization: Bearer {{auth_token}}
Content-Type: application/json

{
    "title": "什么是JWT",
    "content": "# JWT (JSON Web Token)\n\nJWT 是一种开放标准..."
}
```

#### 步骤 4: 获取所有知识点
```http
GET {{base_url}}/api/knowledge-points
Authorization: Bearer {{auth_token}}
```

#### 步骤 5: 获取当前用户信息
```http
GET {{base_url}}/api/users/me
Authorization: Bearer {{auth_token}}
```

## 🛡️ 安全最佳实践

1. **使用环境变量**：永远不要在请求中硬编码敏感信息
2. **自动 Token 管理**：使用 Tests 脚本自动保存和更新 Token
3. **定期清理**：测试完成后清除环境变量中的敏感数据
4. **环境隔离**：为开发、测试、生产环境创建不同的环境配置

## 🔧 故障排除

### 常见错误及解决方案

1. **401 Unauthorized**
   - 检查 Token 是否正确设置
   - 确认 Token 未过期
   - 验证 Authorization 头格式：`Bearer {{auth_token}}`

2. **400 Bad Request**
   - 检查请求体 JSON 格式
   - 确认必需字段已提供

3. **500 Internal Server Error**
   - 检查服务器日志
   - 确认数据库连接正常

## 📝 测试检查清单

- [ ] 环境变量正确设置
- [ ] 服务器正在运行 (http://localhost:3000)
- [ ] 数据库连接正常
- [ ] Token 自动保存到环境变量
- [ ] 所有 API 端点响应正常







