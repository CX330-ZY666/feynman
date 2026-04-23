# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## 项目概述

这是一个基于费曼学习法的教育平台,采用前后端分离架构。核心功能流程:用户录音 → 语音转文字(Whisper) → AI评价理解程度 → 生成反馈。

### 技术栈
- **后端**: Node.js + Express + MongoDB + Mongoose
- **前端**: React + Vite + React Router
- **AI服务**: 百度千帆大模型、OpenAI Whisper(本地)
- **语音处理**: 百度语音识别API + 本地Whisper API(Python Flask)

### 架构设计
```
feynman-platform-backend/    - Node.js后端API服务
  ├── models/                - Mongoose数据模型
  ├── routes/                - Express路由
  ├── controllers/           - 业务逻辑控制器
  ├── middleware/            - 认证中间件(JWT)
  ├── services/              - 向量存储服务(RAG)
  └── whisper-api/           - Python Flask本地语音识别服务

feynman-platform-frontend/   - React前端应用
  ├── src/pages/             - 页面组件
  ├── src/components/        - 可复用组件
  ├── src/context/           - React Context(认证状态管理)
  └── src/api/               - Axios API客户端
```

## 常用开发命令

### 后端开发
```powershell
# 在 feynman-platform-backend/ 目录下

# 启动开发服务器(nodemon热重载)
npm run dev

# 启动生产服务器
npm start

# 统一启动后端+Whisper服务(Windows)
start-all.bat
```

### 前端开发
```powershell
# 在 feynman-platform-frontend/ 目录下

# 启动开发服务器(端口5173)
npm run dev

# 构建生产版本
npm run build

# ESLint代码检查
npm run lint

# Electron桌面端开发
npm run electron:dev

# 构建Electron应用
npm run electron:build
```

### Whisper API服务
```powershell
# 在 feynman-platform-backend/whisper-api/ 目录下

# 首次安装(Windows)
setup-whisper.bat

# 手动启动
venv\Scripts\activate    # 激活虚拟环境
python app.py            # 启动服务(端口5001)
```

### 测试相关
```bash
# 后端目录下有多个测试脚本
node test-ai-coach.js              # 测试AI教练功能
node test-qianfan-v2.js            # 测试千帆大模型
node test-models-speed.js          # 测试AI模型响应速度
node debug-qianfan.js              # 调试千帆API连接
```

## 核心数据模型

### User (models/User.js)
用户账户,包含用户名、邮箱、密码(bcrypt加密)

### KnowledgePoint (models/KnowledgePoint.js)
知识点核心模型,包含:
- 标题、描述、详细内容(Markdown)
- 创建者引用
- 时间戳

### FeynmanAttempt (models/FeynmanAttempt.js)
用户费曼学习尝试记录,包含:
- 关联知识点和用户
- 录音转录文本
- AI评分和详细反馈
- 知识点掌握程度分析

### KnowledgeRelation (models/KnowledgeRelation.js)
知识点之间的关系图谱

## 主要API路由

### 认证相关 (/api/users)
- POST /register - 用户注册
- POST /login - 用户登录(返回JWT token)
- GET /me - 获取当前用户信息(需认证)

### 知识点管理 (/api/knowledge-points)
- GET / - 获取所有知识点列表
- GET /:id - 获取单个知识点详情
- POST / - 创建新知识点(需认证)
- PUT /:id - 更新知识点(需认证)
- DELETE /:id - 删除知识点(需认证)

### 音频处理 (/api/audio)
- POST /transcribe - 使用百度API转录音频(需认证)
- POST /transcribe-local - 使用本地Whisper转录(需认证)
- GET /whisper-status - 检查Whisper服务状态
- POST /evaluate - AI评价费曼复述(需认证)

### 费曼学习记录 (/api/feynman-attempts)
- GET /:knowledgePointId - 获取某知识点的所有学习记录
- POST / - 创建新的学习记录

### AI相关 (/api/ai)
AI评价、问答生成等功能

### 知识图谱 (/api/graph, /api/relations)
知识点关系可视化相关接口

## 认证机制

采用JWT(JSON Web Token)认证:
1. 用户登录后,后端返回JWT token
2. 前端将token存储在localStorage
3. 后续请求通过 `x-auth-token` 请求头传递token
4. 后端middleware/auth.js验证token有效性

前端通过AuthContext管理全局登录状态。

## 环境变量配置

### 后端 (.env)
```env
MONGO_URI=mongodb://localhost:27017/feynman-platform  # MongoDB连接
JWT_SECRET=your-secret-key                             # JWT密钥
BAIDU_APP_ID=xxx                                       # 百度AI应用ID
BAIDU_API_KEY=xxx                                      # 百度API密钥
BAIDU_SECRET_KEY=xxx                                   # 百度Secret密钥
QIANFAN_ACCESS_KEY=xxx                                 # 千帆访问密钥
QIANFAN_SECRET_KEY=xxx                                 # 千帆Secret密钥
WHISPER_API_URL=http://localhost:5001                  # Whisper服务地址
WHISPER_MODEL=base                                     # Whisper模型大小
ENABLE_WHISPER=true                                    # 是否启用Whisper
```

### 前端 (.env)
```env
VITE_API_BASE_URL=http://localhost:3000/api           # 后端API地址
```

## 关键技术特性

### 语音识别双模式
- **百度语音识别**: 云端API,快速但需要网络
- **本地Whisper**: 离线识别,保护隐私,支持GPU加速

### AI评价系统
使用百度千帆大模型(ERNIE系列)评估用户的费曼复述质量:
- 理解程度打分
- 详细反馈建议
- 知识点掌握分析

### RAG知识库
services/vectorStoreService.js 实现向量存储,用于:
- 知识点语义检索
- 相关知识推荐
- 使用HNSwlib进行向量索引

### 富文本编辑器
前端使用TipTap/ReactQuill支持Markdown编辑,支持:
- 公式渲染(KaTeX)
- Mermaid图表
- 代码高亮
- XSS防护(DOMPurify)

### 知识图谱可视化
- 2D图谱: ECharts
- 3D宇宙视图: Three.js + D3-force-3d

## Windows平台注意事项

1. **PowerShell执行策略**: 如遇到脚本无法执行,需设置:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

2. **路径分隔符**: 代码中已处理Windows路径(`\`)和Unix路径(`/`)兼容性

3. **并发启动**: 使用`start-all.bat`在独立cmd窗口中启动多个服务

4. **ffmpeg依赖**: 项目包含ffmpeg-8.0-essentials_build用于音频处理

## 开发建议

### 新增知识点页面
前端页面位于 src/pages/,路由在 src/App.jsx 配置。需要:
1. 创建页面组件
2. 在App.jsx中添加路由
3. 可能需要在Layout.jsx导航栏中添加链接
4. 使用ProtectedRoute包裹需要认证的路由

### 新增后端API
1. 在routes/目录创建或修改路由文件
2. 在controllers/中实现业务逻辑
3. 如需数据库操作,在models/中定义Mongoose Schema
4. 在index.js中注册新路由: `app.use('/api/xxx', require('./routes/xxx'))`
5. 需要认证的路由使用 `const auth = require('../middleware/auth')` 中间件

### AI服务扩展
百度AI服务封装在controllers/baiduAiController.js,包含:
- 语音识别(ASR)
- 大模型调用(ERNIE-Bot)
- 错误处理和重试机制

### 调试技巧
- 后端使用nodemon自动重启,修改后无需手动重启
- 前端Vite支持HMR,组件修改即时生效
- 查看MongoDB数据可使用MongoDB Compass或Studio 3T
- Whisper服务日志在对应cmd窗口查看
- 使用 test-*.js 脚本快速验证各模块功能

## 项目文档
- AGENTS.md - AI代理角色设定和核心思维规范
- feynman-platform-backend/README.md - 后端详细说明
- whisper-api/README.md - Whisper服务详细说明
- 课程文档/ - 教学过程文档

## 用户交互规范(AGENTS.md)

### AI助手指导原则
- **语言协议**: 英文思考逻辑,中文输出回复
- **表格输出**: 禁用Markdown表格,使用ASCII线条(---、|)模拟,保持列严格对齐
- **代码任务**: 输出可执行代码,而非仅说明修改点
- **完整流程**: 理解需求 → 展示现状 → 执行修改 → 验证结果
- **主动反馈**: 回答后询问是否解决核心问题

### 思维方法论
- 深度优先: 追求第一性原理
- 系统思考: MECE原则(相互独立、完全穷尽)
- 盲点识别: 主动发现隐含假设
- 决策优先级: 准确性 > 完整性 > 创新性
