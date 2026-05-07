/**
 * ============================================================================
 * 费曼学习平台 - 后端服务入口文件
 * ============================================================================
 *
 * 项目简介：
 * 费曼学习平台是一个基于费曼学习法的智能学习工具，帮助用户通过"教别人"的方式
 * 深入理解和掌握知识点。平台集成了 AI 语音识别、智能评价、知识图谱等功能。
 *
 * 技术栈：
 * - Express.js: Node.js Web 框架
 * - MongoDB + Mongoose: 数据库及 ODM
 * - 百度 AI: 语音识别、千帆大模型
 * - LangChain: RAG 检索增强生成
 *
 * 作者：Feynman Platform Team
 * ============================================================================
 */

// ==================== 依赖导入 ====================
const express = require('express');     // Express Web 框架
const mongoose = require('mongoose');   // MongoDB ODM 库
const cors = require('cors');           // 跨域资源共享中间件

// 加载环境变量（从 .env 文件读取配置）
require('dotenv').config();

// ==================== 应用初始化 ====================
const app = express();                              // 创建 Express 应用实例
const port = process.env.PORT || 3000;              // 服务端口，优先使用环境变量配置

const parseOrigins = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const configuredOrigins = [
  ...parseOrigins(process.env.CORS_ORIGIN),
  ...parseOrigins(process.env.CORS_ORIGINS),
  ...parseOrigins(process.env.FRONTEND_URL),
  ...parseOrigins(process.env.CLIENT_URL),
];

if (process.env.VERCEL_URL) {
  configuredOrigins.push(`https://${process.env.VERCEL_URL}`);
}

const originAllowList = new Set(configuredOrigins);

const allowVercelPreview = process.env.ALLOW_VERCEL_PREVIEWS === 'true';

const isVercelOrigin = (origin) => {
  try {
    return new URL(origin).hostname.endsWith('.vercel.app');
  } catch (error) {
    return false;
  }
};

const isTrustedFeynmanFrontendOrigin = (origin) => {
  try {
    const hostname = new URL(origin).hostname;
    return hostname.endsWith('.vercel.app') && hostname.includes('feynman');
  } catch (error) {
    return false;
  }
};

const isLocalDevOrigin = (origin) => {
  try {
    const { hostname, port } = new URL(origin);
    const localHosts = new Set(['localhost', '127.0.0.1', '::1', '172.30.207.163']);
    const localDevPorts = new Set(['5173', '5174', '4173', '3000']);
    return localHosts.has(hostname) && localDevPorts.has(port);
  } catch (error) {
    return false;
  }
};

// ==================== 核心中间件配置 ====================
const corsOptions = {
  origin: (origin, callback) => {
    // 允许 Postman/服务器间调用（没有 Origin 头）
    if (!origin) return callback(null, true);

    // 开发环境默认放行本地前端
    if (process.env.NODE_ENV !== 'production' && isLocalDevOrigin(origin)) {
      return callback(null, true);
    }
    if (originAllowList.has(origin)) {
      return callback(null, true);
    }

    // 放行本项目前端在 Vercel 的生产/别名域名
    if (isTrustedFeynmanFrontendOrigin(origin)) {
      return callback(null, true);
    }

    // 可选：允许 Vercel 预览环境域名（如 PR 部署）
    if (allowVercelPreview && isVercelOrigin(origin)) {
      return callback(null, true);
    }

    // 兜底：生产环境未配置白名单时，先放行，避免线上全部跨域失败
    if (process.env.NODE_ENV === 'production' && originAllowList.size === 0) {
      return callback(null, true);
    }

    if (isLocalDevOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
};

app.use(cors(corsOptions));                         // 生产环境按白名单放行 CORS
app.use(express.json());                            // 解析 JSON 请求体

// ==================== 数据库连接 ====================
/**
 * 连接 MongoDB 数据库
 * 使用 async/await 处理异步连接
 * 连接失败时输出详细错误信息并退出进程
 */
const connectDB = async () => {
  try {
    // 使用环境变量中的连接字符串连接 MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected successfully!');
  } catch (err) {
    // 连接失败时输出错误信息和解决方案
    console.error('❌ MongoDB connection error:', err.message);
    console.log('\n🔧 解决方案:');
    console.log('1. 如果您使用本地 MongoDB: 确保 MongoDB 服务正在运行');
    console.log('2. 如果您使用 MongoDB Atlas: 检查连接字符串和认证信息');
    console.log('3. 检查 .env 文件中的 MONGO_URI 配置');
    console.log('\n📝 示例配置:');
    console.log('本地: mongodb://localhost:27017/feynman-platform');
    console.log('Atlas: mongodb+srv://username:password@cluster.mongodb.net/feynman-platform');
    process.exit(1);  // 连接失败时退出进程
  }
};

// 执行数据库连接
connectDB();

// ==================== API 路由注册 ====================
// 用户相关路由（注册、登录、Token 刷新）
app.use('/api/users', require('./routes/users'));

// 知识点 CRUD 路由
app.use('/api/knowledge-points', require('./routes/knowledgePoints'));

// 音频处理路由（语音上传）
app.use('/api/audio', require('./routes/audio'));

// 学习尝试记录路由（旧版）
app.use('/api/attempts', require('./routes/attempts'));

// 费曼学习尝试记录路由
app.use('/api/feynman-attempts', require('./routes/feynmanAttempts'));

// AI 相关路由（题目生成、答案评判、RAG 问答）
app.use('/api/ai', require('./routes/ai'));

// 知识图谱路由
app.use('/api/graph', require('./routes/graph'));

// 知识点关系路由
app.use('/api/relations', require('./routes/knowledgeRelations'));

// 费曼练习路由（AI 学生对话）
app.use('/api/feynman-practice', require('./routes/feynmanPractice'));

// ==================== 健康检查端点 ====================
/**
 * 健康检查接口
 * 用于监控服务是否正常运行（如：负载均衡器健康检查）
 * @route GET /api/health
 * @returns {Object} 服务状态信息
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Feynman Platform API is running' });
});

// ==================== 启动服务器 ====================
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Feynman Platform backend is running at http://localhost:${port}`);
  });
}

module.exports = app;
