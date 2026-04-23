# 后端CORS配置说明

## 重要提醒
为了完成前后端联调，您需要在后端项目中配置CORS支持。请按照以下步骤操作：

### 1. 安装cors中间件
在后端项目目录 (`feynman-platform-backend`) 中运行：
```bash
npm install cors
```

### 2. 修改后端index.js文件
在 `backend/index.js` 文件中添加以下配置：

```javascript
// backend/index.js
const express = require('express');
const cors = require('cors'); // 1. 引入cors
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// --- 中间件 ---
app.use(cors()); // 2. 在所有路由之前使用cors中间件
app.use(express.json());

// --- 路由 ---
app.use('/api/users', require('./routes/users'));
app.use('/api/knowledge-points', require('./routes/knowledgePoints'));

// ... 其他代码保持不变
```

### 3. 重启后端服务器
修改完成后，需要重启后端服务器：
1. 在终端中按 `Ctrl+C` 停止服务器
2. 重新运行 `node index.js` 启动服务器

### 4. 验证配置
配置完成后，前端应该能够正常与后端API通信。

## 注意事项
- CORS配置必须在所有路由之前
- 生产环境中建议配置具体的允许域名，而不是允许所有来源
- 如果遇到跨域问题，请检查后端服务器是否正在运行






