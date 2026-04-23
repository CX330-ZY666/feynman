# Vercel + Render 部署说明（前后端分离）

## 0. 先做一次安全处理（必须）
你当前仓库里已经出现过真实密钥，部署前请先在各平台控制台轮换（重置）这些密钥：
- MongoDB 账号密码
- JWT_SECRET / JWT_REFRESH_SECRET
- Baidu / Qianfan / DeepSeek 所有 Key

然后把新密钥只配置在部署平台环境变量中，不要再提交到 Git。

## 1. 部署后端到 Render

### 1.1 新建 Web Service
- 代码目录：`feynman-platform-backend`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`

### 1.2 配置环境变量（Render -> Environment）
至少配置：
- `NODE_ENV=production`
- `PORT=10000`（Render 会自动注入，手动填也可）
- `MONGO_URI=...`
- `JWT_SECRET=...`
- `JWT_REFRESH_SECRET=...`
- `JWT_REFRESH_EXPIRES_IN=7d`
- `CORS_ORIGINS=https://你的前端域名.vercel.app`
- `BAIDU_APP_ID=...`
- `BAIDU_API_KEY=...`
- `BAIDU_SECRET_KEY=...`
- `QIANFAN_ACCESS_KEY=...`
- `QIANFAN_SECRET_KEY=...`
- `QIANFAN_IAM_ACCESS_KEY=...`
- `QIANFAN_IAM_SECRET_KEY=...`

如果暂时不用本地 Whisper：
- `ENABLE_WHISPER=false`

### 1.3 健康检查
部署成功后访问：
- `https://你的-render域名.onrender.com/api/health`

返回 `status: OK` 即后端可用。

## 2. 部署前端到 Vercel

### 2.1 导入项目
- Root Directory: `feynman-platform-frontend`
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

### 2.2 配置环境变量（Vercel -> Settings -> Environment Variables）
- `VITE_API_URL=https://你的-render域名.onrender.com/api`
- `VITE_ENABLE_WHISPER=false`（按需）

### 2.3 重新部署
修改环境变量后，点击 Redeploy 一次，确保新变量生效。

## 3. 联调检查清单
1. 前端能打开登录页
2. 登录请求发往 Render 域名 `/api/users/login`
3. 后端无 CORS 报错
4. 登录后能正常获取用户信息和知识点列表

## 4. 常见问题
- 401 Token 问题：检查 `JWT_SECRET` 和 `JWT_REFRESH_SECRET` 是否一致且未误删。
- CORS 报错：检查 `CORS_ORIGINS` 是否包含 Vercel 实际域名（包含协议 `https://`）。
- 首次 Render 冷启动慢：免费实例会休眠，首次请求慢属正常。
- MongoDB 连接失败：检查 Atlas IP 白名单和账号密码。
