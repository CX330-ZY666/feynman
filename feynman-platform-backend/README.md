# Feynman Platform Backend

费曼学习法平台后端 API 服务

## 功能特性

- 用户注册和登录
- JWT 身份验证
- 知识点管理
- RESTful API 设计
- **音频转录**: 百度 API + 本地 Whisper 双模式
- **AI 评价**: 百度千帆大模型评价费曼复述

## 技术栈

- Node.js + Express.js
- MongoDB + Mongoose
- JWT + bcryptjs
- **Python Flask** (Whisper API 服务)
- **OpenAI Whisper** (本地语音识别)
- **百度 AI SDK** (语音识别 + 大模型)

## 安装和运行

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
创建 `.env` 文件并配置以下变量：

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017/feynman-platform  # 或使用 Atlas
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-here
NODE_ENV=development

# 百度 AI
BAIDU_APP_ID=your_app_id
BAIDU_API_KEY=your_api_key
BAIDU_SECRET_KEY=your_secret_key
QIANFAN_ACCESS_KEY=your_qianfan_key

# Whisper 本地转录
WHISPER_API_URL=http://localhost:5001
WHISPER_MODEL=base
ENABLE_WHISPER=true
```

**注意**: 如果使用 MongoDB Atlas，请确保：
1. 在 Atlas 控制台中创建了数据库用户
2. 设置了正确的用户名和密码
3. 在 Network Access 中添加了您的 IP 地址（或设置为 0.0.0.0/0 允许所有 IP）
4. 连接字符串中的用户名和密码正确

### 3. 安装 Whisper 服务（可选）
如果需要使用本地 Whisper 转录：

```bash
cd whisper-api
setup-whisper.bat  # Windows
# 或手动安装：see whisper-api/README.md
```

### 4. 启动服务

#### 方法 1: 统一启动（推荐）
```bash
start-all.bat  # Windows
# 自动启动 Node.js + Whisper 服务
```

#### 方法 2: 分开启动
```bash
# 终端 1: Node.js 后端
npm run dev

# 终端 2: Whisper API
cd whisper-api
venv\Scripts\activate  # Windows
python app.py
```

## API 端点

### 用户相关
- `POST /api/users/register` - 用户注册
- `POST /api/users/login` - 用户登录
- `GET /api/users/me` - 获取当前用户信息 (需要认证)

### 知识点相关
- `GET /api/knowledge-points` - 获取所有知识点
- `GET /api/knowledge-points/:id` - 获取单个知识点
- `POST /api/knowledge-points` - 创建知识点 (需要认证)
- `PUT /api/knowledge-points/:id` - 更新知识点 (需要认证)
- `DELETE /api/knowledge-points/:id` - 删除知识点 (需要认证)

### 音频转录相关
- `POST /api/audio/transcribe` - 使用百度 API 转录音频 (需要认证)
- `POST /api/audio/transcribe-local` - **使用本地 Whisper 转录** (需要认证)
- `GET /api/audio/whisper-status` - 获取 Whisper 服务状态 (需要认证)
- `POST /api/audio/evaluate` - AI 评价费曼复述 (需要认证)

### 健康检查
- `GET /api/health` - Node.js 服务健康检查
- `GET http://localhost:5001/health` - Whisper API 健康检查

## 认证

使用 JWT token 进行身份验证。在请求头中添加：
```
x-auth-token: your-jwt-token
```
