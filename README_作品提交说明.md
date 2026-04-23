# 费曼学习法平台 - 作品提交说明

本压缩包用于飞书校园AI挑战赛评审，目标是“打开即看，按步骤可运行”。

## 1. 项目内容
- 前端：React + Vite + Electron（开发模式可直接网页访问）
- 后端：Node.js + Express + MongoDB
- AI能力：语音转文字（Whisper/百度）、AI测评与反馈

## 2. 评审环境建议
- Windows 10/11（优先）
- Node.js 18+
- npm 9+
- MongoDB（本地或 Atlas）
- Python 3.10+（仅当启用本地 Whisper）

## 3. 快速运行（本地）
1) 解压后进入项目根目录
2) 按下列顺序执行：
   - `cd feynman-platform-backend && npm install`
   - `cd ../feynman-platform-frontend && npm install`
3) 复制并配置环境变量：
   - 后端：`feynman-platform-backend/.env`（按 README 中变量填写）
   - 前端：`feynman-platform-frontend/.env`（至少配置 `VITE_API_URL`）
4) 启动后端：
   - `cd feynman-platform-backend && npm run dev`
5) 启动前端：
   - 新终端中 `cd feynman-platform-frontend && npm run dev`
6) 打开浏览器访问：
   - `http://localhost:5173`

## 4. 一键启动脚本（可选）
压缩包中提供 `start-review.bat`，会按相对路径启动前后端。

## 5. 默认不包含的内容（为了可传输、可复现）
- `node_modules`、`.git`、构建产物（`dist`/`release`）
- 上传缓存、临时文件、向量索引等大文件夹
- `.env` 等敏感配置文件

## 6. 在线部署说明
可参考根目录文档：`DEPLOY_VERCEL_RENDER.md`

---
如果评审只需要“可看”，可先直接查看以下文档：
- 项目部署说明、测试说明、课程设计文档
- 前后端 README 与关键功能说明文档
