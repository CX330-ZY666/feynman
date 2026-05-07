# 费曼学习平台部署指南

## 部署架构
- **前端**: Vercel (自动部署)
- **后端**: Railway (推荐) 或 Render
- **数据库**: MongoDB Atlas

---

## 一、后端部署 (Railway)

### 1. 准备工作
确保后端代码已推送到 GitHub

### 2. 部署到 Railway

1. 访问 [Railway.app](https://railway.app)
2. 使用 GitHub 登录
3. 点击 "New Project" → "Deploy from GitHub repo"
4. 选择 `CX330-ZY666/feynman` 仓库
5. 选择 `feynman-platform-backend` 目录

### 3. 配置环境变量

在 Railway 项目设置中添加以下环境变量：

```bash
# MongoDB
MONGO_URI=mongodb+srv://your-username:your-password@cluster.mongodb.net/feynman?retryWrites=true&w=majority

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this

# 百度AI
BAIDU_APP_ID=your-baidu-app-id
BAIDU_API_KEY=your-baidu-api-key
BAIDU_SECRET_KEY=your-baidu-secret-key
BAIDU_QIANFAN_AK=your-qianfan-ak
BAIDU_QIANFAN_SK=your-qianfan-sk

# DeepSeek AI
DEEPSEEK_API_KEY=your-deepseek-api-key

# 端口
PORT=3000
```

### 4. 获取后端URL
部署成功后，Railway 会提供一个 URL，类似：
```
https://feynman-backend-production.up.railway.app
```

---

## 二、前端部署 (Vercel)

### 1. 更新前端API地址

编辑 `feynman-platform-frontend/.env.production`:
```bash
VITE_API_URL=https://your-railway-backend-url.railway.app/api
```

### 2. 部署到 Vercel

1. 访问 [Vercel.com](https://vercel.com)
2. 使用 GitHub 登录
3. 点击 "Add New" → "Project"
4. 选择 `CX330-ZY666/feynman` 仓库
5. 配置项目：
   - **Framework Preset**: Vite
   - **Root Directory**: `feynman-platform-frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 3. 配置环境变量

在 Vercel 项目设置中添加：
```bash
VITE_API_URL=https://your-railway-backend-url.railway.app/api
```

### 4. 部署
点击 "Deploy"，Vercel 会自动构建和部署

---

## 三、MongoDB Atlas 配置

### 1. 创建数据库
1. 访问 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. 创建免费集群 (M0)
3. 创建数据库用户
4. 添加 IP 白名单：`0.0.0.0/0` (允许所有IP)

### 2. 获取连接字符串
```
mongodb+srv://<username>:<password>@cluster.mongodb.net/feynman?retryWrites=true&w=majority
```

---

## 四、验证部署

### 1. 测试后端
访问: `https://your-backend-url.railway.app/api/health`
应该返回: `{"status": "ok"}`

### 2. 测试前端
访问: `https://your-app.vercel.app`
应该能正常打开并登录

---

## 五、自动部署

### GitHub Actions (可选)

两个平台都支持自动部署：
- **Railway**: 推送到 `main` 分支自动部署后端
- **Vercel**: 推送到 `main` 分支自动部署前端

---

## 六、常见问题

### 1. CORS 错误
确保后端 `index.js` 中 CORS 配置正确：
```javascript
app.use(cors({
  origin: ['https://your-app.vercel.app', 'http://localhost:5173'],
  credentials: true
}));
```

### 2. 环境变量未生效
- Railway: 修改后需要重新部署
- Vercel: 修改后需要重新部署

### 3. 数据库连接失败
检查：
- MongoDB Atlas IP 白名单
- 连接字符串格式
- 用户名密码是否正确

---

## 七、成本估算

- **MongoDB Atlas**: 免费 (512MB)
- **Railway**: 免费 $5/月额度
- **Vercel**: 免费 (个人项目)

**总计**: 完全免费 ✅

---

## 八、快速部署命令

```bash
# 1. 推送代码
git push origin main

# 2. 前端构建测试
cd feynman-platform-frontend
npm run build

# 3. 后端启动测试
cd ../feynman-platform-backend
npm start
```

---

## 需要帮助？

如果遇到问题，检查：
1. Railway 部署日志
2. Vercel 部署日志
3. 浏览器控制台错误
4. MongoDB Atlas 连接日志
