# 百度智能云语音识别集成指南

## 概述
本项目已修复了前端语音录制的 bug（双重 getUserMedia 调用导致的权限冲突）。
现在需要在后端集成百度智能云 API 来完成语音转文字功能。

## 修复内容（前端）

### 问题根因
- 在 `FeynmanRecordPage.jsx` 和 `VoiceRecorder.jsx` 中
- `setupVolumeMeter()` 和 `handleStart()` 各自调用一次 `getUserMedia()`
- 导致浏览器弹出两个权限对话框或权限冲突，用户点击开始录音后自动跳转回主页

### 修复方案
✅ 合并两个 `getUserMedia()` 调用为一个
✅ `handleStart()` 先获取 stream，然后将其传递给 `setupVolumeMeter(stream)`
✅ 避免权限对话框冲突，流程正常进行

---

## 后端集成百度 API

### 1. 百度智能云申请

访问 [百度智能云官网](https://cloud.baidu.com/)：
1. 注册账号并登录
2. 进入控制台 → 产品与服务 → AI 服务 → 语音识别
3. 创建应用（或使用已有应用）
4. 获取以下凭证：
   - **App ID** (Client ID)
   - **API Key** (Secret Key)

### 2. 后端 Node.js/Express 集成

#### 安装依赖
```bash
npm install baidu-aip-sdk
# 或使用 axios 调用 REST API
npm install axios
```

#### 方案 A：使用官方 SDK（推荐）

```javascript
// routes/audio.js (或 audioRouter.js)
const express = require('express');
const AipSpeechClient = require('baidu-aip-sdk').speech;
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// 百度 API 凭证
const APP_ID = process.env.BAIDU_APP_ID;
const API_KEY = process.env.BAIDU_API_KEY;
const SECRET_KEY = process.env.BAIDU_SECRET_KEY;

const client = new AipSpeechClient(APP_ID, API_KEY, SECRET_KEY);

// 语音转文字端点
router.post('/audio/transcribe', upload.single('audio'), async (req, res) => {
    try {
        const audioBuffer = req.file.buffer;
        const mimeType = req.file.mimetype || 'audio/wav';
        
        // 调用百度语音识别 API
        const result = await client.recognize(audioBuffer, 'wav', 16000, {
            'lan': 'zh'
        });
        
        if (result.err_no === 0) {
            // 识别成功
            const transcribedText = result.result?.[0] || '';
            res.json({
                code: 0,
                msg: '转录成功',
                result: transcribedText,
                transcription: transcribedText
            });
        } else {
            // 识别失败
            res.status(400).json({
                code: result.err_no,
                msg: result.err_msg || '百度 API 转录失败'
            });
        }
    } catch (error) {
        console.error('语音识别错误:', error);
        res.status(500).json({
            code: 500,
            msg: '服务器错误：' + error.message
        });
    }
});

module.exports = router;
```

#### 方案 B：使用 REST API（如果不想使用 SDK）

```javascript
const express = require('express');
const axios = require('axios');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const APP_ID = process.env.BAIDU_APP_ID;
const API_KEY = process.env.BAIDU_API_KEY;
const SECRET_KEY = process.env.BAIDU_SECRET_KEY;

// 获取百度 API 的 access_token（需要缓存）
let accessToken = null;
let tokenExpireTime = 0;

async function getAccessToken() {
    if (accessToken && Date.now() < tokenExpireTime) {
        return accessToken;
    }
    
    try {
        const response = await axios.get('https://aip.baidubce.com/oauth/2.0/token', {
            params: {
                grant_type: 'client_credentials',
                client_id: API_KEY,
                client_secret: SECRET_KEY
            }
        });
        
        accessToken = response.data.access_token;
        tokenExpireTime = Date.now() + (response.data.expires_in * 1000 - 60000); // 提前 1 分钟刷新
        return accessToken;
    } catch (error) {
        console.error('获取 access_token 失败:', error);
        throw error;
    }
}

router.post('/audio/transcribe', upload.single('audio'), async (req, res) => {
    try {
        const audioBuffer = req.file.buffer;
        const token = await getAccessToken();
        
        // 调用百度语音识别 API
        const response = await axios.post(
            `https://vop.baidu.com/server_api`,
            {
                format: 'wav',
                rate: 16000,
                channel: 1,
                speech: audioBuffer.toString('base64'),
                cuid: 'feynman-app',
                token: token,
                len: audioBuffer.length
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (response.data.err_no === 0) {
            const transcribedText = response.data.result?.[0] || '';
            res.json({
                code: 0,
                msg: '转录成功',
                result: transcribedText
            });
        } else {
            res.status(400).json({
                code: response.data.err_no,
                msg: response.data.err_msg || '转录失败'
            });
        }
    } catch (error) {
        console.error('语音识别错误:', error);
        res.status(500).json({
            code: 500,
            msg: '服务器错误'
        });
    }
});

module.exports = router;
```

### 3. 环境变量配置

在 `.env` 文件中添加：

```env
BAIDU_APP_ID=your_app_id_here
BAIDU_API_KEY=your_api_key_here
BAIDU_SECRET_KEY=your_secret_key_here
```

### 4. 后端 app.js 配置

```javascript
const audioRouter = require('./routes/audio');
app.use('/api', audioRouter);
```

---

## 前端调用流程

已有的前端代码会自动：
1. 录制用户语音为 WAV 格式
2. POST 到 `/api/audio/transcribe`
3. 后端调用百度 API 进行转录
4. 返回转录文本给前端
5. 前端显示并允许用户编辑

---

## 测试步骤

1. 配置百度 API 凭证到 `.env`
2. 启动后端服务
3. 前端打开 **二次编辑页面** (`/feynman/:id`)
4. 点击 **"开始录音"** 按钮
5. 说出一段话，点 **"停止录音"**
6. 系统自动上传并调用百度 API 进行转录
7. 转录结果显示在下方文本框中

---

## 常见问题

| 问题 | 原因 | 解决方案 |
|-----|------|--------|
| 点击开始录音后跳回主页 | 权限被拒绝或 getUserMedia 失败 | ✅ 已通过合并 getUserMedia 调用修复 |
| 转录结果为空 | 百度 API 凭证错误或音频质量差 | 检查 .env 凭证；确保话筒清晰 |
| 报错 "Access Token 失败" | API Key 或 Secret Key 错误 | 重新验证百度智能云控制台凭证 |
| 前端显示 "转录失败" | 网络问题或后端服务未启动 | 检查后端服务状态和网络连接 |

---

## 相关文档
- [百度语音识别 API 文档](https://ai.baidu.com/ai-doc/SPEECH/Vk4e9x4uu)
- [baidu-aip-sdk npm 包](https://www.npmjs.com/package/baidu-aip-sdk)
