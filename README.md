# 费曼学习平台

React + Spring Boot + MySQL 学习平台，支持知识点管理、录音复述、AI教练、费曼问答、测评、RAG助手和知识图谱。

## 当前结构

- `feynman-platform-frontend/`：React + Vite，保留Electron支持。
- `feynman-platform-springboot/`：Java 21 + Spring Boot + MyBatis Plus + MySQL，唯一正在使用的后端。
- `deploy/`：GitHub Actions自动构建与Windows服务器部署。
- `ffmpeg-8.0-essentials_build/`：音频工具。

旧Node/MongoDB后端已在项目外备份并移除。Git历史仍保留旧代码，删除当前目录不等于清除历史。历史课程笔记不代表当前运行方式。

## 本地启动（Windows）

准备Java 21、Node.js 22和MySQL 8，先创建数据库并配置凭据。Spring Boot不会自动读取旧后端的.env。

一个PowerShell窗口启动后端：

```powershell
cd feynman-platform-springboot
$env:DB_USERNAME = 'feynman_app'
$env:DB_PASSWORD = '填写本机数据库密码'
$env:JWT_SECRET = '填写足够长的随机密钥'
.\mvnw.cmd spring-boot:run
```

默认数据库名为feynman_platform，端口8080，Flyway管理表结构。已有用户应沿用原数据库和JWT配置。

另一个PowerShell窗口启动前端：

```powershell
cd feynman-platform-frontend
npm ci
$env:VITE_API_URL = 'http://localhost:8080/api'
npm run dev
```

访问Vite实际打印的地址。配置好环境后，也可双击根目录start-all.bat；脚本不会填写密码。

## 文件导入

新增/编辑知识点 -> 从文件导入 -> 解析预览 -> 修正文字 -> 确认放入编辑器 -> 页面底部保存。

- 支持DOCX、PDF、JPG/JPEG、PNG、UTF-8 TXT和Markdown。旧DOC请另存为DOCX。
- 单文件最多10MB、100000字符；PDF最多20页。
- DOCX提取正文和表格文字，不保留排版及内嵌图片。
- 文字型PDF本地解析；扫描页需同意后使用百度OCR，一次最多5页扫描内容。
- 图片可以OCR，也可仅作为压缩配图插入。当前AI检索只理解文字。
- 原文件不长期保存。OCR会发送图片/扫描页到百度，请勿上传未获授权的敏感资料。
- 公式、表格、手写识别需人工核对。长文档应拆成知识点，以适配测评输入上限。

OCR环境变量：BAIDU_OCR_API_KEY、BAIDU_OCR_SECRET_KEY。未配置专用密钥时尝试BAIDU_API_KEY、BAIDU_SECRET_KEY，但应用必须开通通用文字识别权限并有额度。收费与额度以百度控制台为准。文字文档和仅配图模式不需要OCR密钥。

## 测试与构建

```powershell
cd feynman-platform-springboot
.\mvnw.cmd package
cd ..\feynman-platform-frontend
npm run build
npm run lint
```

OCR单元测试使用替身，不能证明生产环境OCR权限已开通。

## 云端更新

本地修改不会立即改变网站；提交并推送main后，Actions才会测试、构建、部署。完整说明见 [deploy/README.md](deploy/README.md)。

不要提交密码、API密钥、私钥、真实用户数据或模型。自动部署不覆盖服务器启动脚本和模型。
