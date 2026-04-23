# AI选择题解析功能故障排查指南

## 问题现象
选择题提交后显示"解析加载失败"或"AI解析暂时不可用"

## 排查步骤

### 1. 检查环境变量配置

确保`.env`文件中配置了百度千帆API密钥:

```bash
# 在后端项目根目录执行
cat .env | grep QIANFAN_ACCESS_KEY
```

应该看到类似:
```
QIANFAN_ACCESS_KEY=bce-v3/xxx...
```

如果没有配置或配置错误,请到[百度智能云](https://console.bce.baidu.com/)获取正确的Access Key。

### 2. 测试后端API

运行测试脚本:

```bash
node test-explain-choice.js
```

**成功输出示例:**
```
✅ API测试成功！
- 是否正确: ❌
- 正确解释长度: 118 字符
- 错误解释长度: 149 字符
- 知识点长度: 89 字符
```

**失败输出示例:**
```
❌ 缺少QIANFAN_ACCESS_KEY配置
```
→ 需要配置环境变量

```
❌ API测试失败
错误信息: Request timeout
```
→ 网络问题或API响应慢

### 3. 检查后端服务是否运行

```bash
# Windows PowerShell
Get-Process -Name node

# 或访问健康检查接口
curl http://localhost:3000/api/health
```

应该看到:
```json
{"status":"OK","message":"Feynman Platform API is running"}
```

### 4. 检查前端API配置

查看浏览器开发者工具 (F12) → Network标签:

1. 找到失败的 `/api/ai/explain-choice` 请求
2. 查看请求详情:
   - **Status Code**: 应该是200,如果是401/403/500需要进一步排查
   - **Request Headers**: 检查是否包含 `Authorization: Bearer xxx`
   - **Response**: 查看错误信息

**常见错误:**

#### 401 Unauthorized
```json
{"msg": "No token, authorization denied"}
```
**原因**: 用户未登录或token过期
**解决**: 重新登录

#### 400 Bad Request
```json
{"msg": "Question, options, correctAnswer, and userAnswer are required."}
```
**原因**: 请求参数不完整
**解决**: 检查题目数据结构

#### 500 Internal Server Error
```json
{"msg": "AI返回格式错误，请稍后重试"}
```
**原因**: AI API返回格式异常
**解决**: 查看后端日志,联系开发者

#### 504 Gateway Timeout
```json
{"msg": "Explanation timeout"}
```
**原因**: AI API响应超过30秒
**解决**: 检查网络连接,稍后重试

### 5. 查看后端日志

后端会输出详细的日志:

```
🎯 AI解析选择题答案...
📝 题目: 在JavaScript中...
👨‍🎓 学生答案: B | 正确答案: A
⏱️ API响应时间: 15268ms
✅ 解析完成: ❌ 答错了
```

如果看到错误日志:
```
❌ 解析失败: Request failed with status code 401
```

常见原因:
- QIANFAN_ACCESS_KEY配置错误
- API密钥已过期
- 账户余额不足

### 6. 测试简单场景

在QuizPage中:
1. 选择"基础"难度
2. 生成1道题
3. 提交答案
4. 查看控制台输出

前端会输出:
```javascript
AI解析失败: Error: Network Error
错误详情: {...}
```

### 7. 网络连接测试

确保前端能访问后端:

```bash
# 在前端项目运行的机器上测试
curl http://localhost:3000/api/health
```

如果前后端在不同机器,确保:
- 后端端口(3000)已开放
- 前端的axios配置指向正确的后端地址

### 8. CORS问题

如果看到浏览器控制台错误:
```
Access to XMLHttpRequest at 'http://localhost:3000/api/ai/explain-choice' 
from origin 'http://localhost:5173' has been blocked by CORS policy
```

检查后端`index.js`中是否配置了CORS:
```javascript
app.use(cors());
```

## 常见解决方案

### 方案1: 重新配置API密钥

1. 登录[百度智能云控制台](https://console.bce.baidu.com/)
2. 进入"千帆大模型平台" → "应用接入" → "Access Key管理"
3. 复制有效的Access Key
4. 更新`.env`文件
5. 重启后端服务

### 方案2: 使用Mock模式(开发环境)

如果暂时无法使用真实API,可以启用Mock模式:

在`.env`中添加:
```env
USE_MOCK_AI=true
```

这样会返回模拟的解析数据,不消耗API调用。

### 方案3: 增加超时时间

如果网络较慢导致超时,可以修改`baiduAiController.js`:

```javascript
// 第804行附近
timeout: 30000  // 改为 60000 (60秒)
```

### 方案4: 降级处理

当前代码已经实现了降级处理。如果AI解析失败,会显示基本的正确/错误判断,并提示"AI解析暂时不可用"。

用户仍然可以看到:
- 是否答对
- 正确答案是什么
- 基本的题目解析(如果AI生成题目时提供了)

## 联系支持

如果以上步骤都无法解决问题,请提供以下信息:

1. 浏览器控制台完整错误信息
2. 后端日志输出
3. `node test-explain-choice.js`运行结果
4. 环境信息:
   - Node.js版本: `node --version`
   - 操作系统
   - 网络环境(是否使用代理等)
