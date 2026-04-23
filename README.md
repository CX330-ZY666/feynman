# 费曼学习平台 (Feynman Learning Platform)

一个基于费曼学习法的全栈教育平台，核心流程是：
录音复述 -> 语音转文字 -> AI 评价理解程度 -> 生成改进反馈。

## 项目结构

- `feynman-platform-backend/`：Node.js + Express 后端 API
- `feynman-platform-frontend/`：React + Vite 前端应用（支持 Electron 桌面开发）

## 核心功能

- 用户注册/登录（JWT 鉴权）
- 知识点管理（创建、编辑、浏览）
- 语音输入与转写（百度 ASR + 本地 Whisper）
- AI 评价与反馈（千帆模型）
- 费曼练习记录管理
- 知识图谱可视化（2D/3D）
- RAG 私有知识库检索

## 技术栈

### 前端
- React
- Vite
- React Router
- ECharts / Three.js

### 后端
- Node.js
- Express
- MongoDB + Mongoose
- LangChain
- fluent-ffmpeg

### AI / 语音
- 百度语音识别 API
- 百度千帆大模型
- 本地 Whisper（Python Flask 服务）

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/CX330-ZY666/feynman.git
cd feynman
```

### 2. 安装依赖

```bash
# 根目录（用于图谱相关依赖）
npm install

# 后端
cd feynman-platform-backend
npm install

# 前端
cd ../feynman-platform-frontend
npm install
```

### 3. 配置环境变量

后端创建 `.env`（参考 `.env.example`），至少包含：

- `MONGO_URI`
- `JWT_SECRET`
- `BAIDU_APP_ID`
- `BAIDU_API_KEY`
- `BAIDU_SECRET_KEY`
- `QIANFAN_ACCESS_KEY`
- `QIANFAN_SECRET_KEY`

前端可配置：

- `VITE_API_BASE_URL`（如 `http://localhost:3000/api`）

### 4. 启动服务

#### 方式 A：分别启动（推荐开发）

```bash
# 后端（端口默认 3000）
cd feynman-platform-backend
npm run dev

# 前端（端口默认 5173）
cd ../feynman-platform-frontend
npm run dev
```

#### 方式 B：后端一键脚本（Windows）

```bash
cd feynman-platform-backend
start-all.bat
```

## 目录说明

### 后端目录要点

- `controllers/`：业务逻辑
- `routes/`：接口路由
- `models/`：数据模型
- `middleware/`：认证中间件
- `services/`：向量检索等服务
- `whisper-api/`：本地 Whisper Python 服务

### 前端目录要点

- `src/pages/`：页面
- `src/components/`：通用组件
- `src/context/`：全局状态（认证）
- `src/api/`：请求封装

## 常见命令

```bash
# 后端开发
cd feynman-platform-backend
npm run dev

# 前端开发
cd feynman-platform-frontend
npm run dev

# 前端构建
npm run build

# Electron 开发
npm run electron:dev
```

## 注意事项

- 不要提交任何 `.env`、密钥、Token。
- 音频处理依赖 ffmpeg，建议在系统中可用或通过项目依赖兜底。
- 首次启用本地 Whisper 时，请先在 `whisper-api/` 完成 Python 依赖安装。

## License

仅用于学习与课程实践。
