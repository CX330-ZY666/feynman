# Whisper 本地转录功能测试指南

本文档提供 Whisper 本地转录功能的完整测试流程和验证清单。

## 前置条件

在开始测试前，请确保：

```bash
# 1. Node.js 依赖已安装
npm install

# 2. Whisper 环境已配置
cd whisper-api
setup-whisper.bat  # Windows
cd ..

# 3. 环境变量已配置
# 检查 .env 文件包含：
# WHISPER_API_URL=http://localhost:5001
# WHISPER_MODEL=base
# ENABLE_WHISPER=true

# 4. 前端依赖已安装（如需测试前端）
cd ..\feynman-platform-frontend
npm install
```

## Phase 5 测试任务清单

### Task 24: Whisper API 单元测试 ✓

**测试目标**: 验证 Python Flask Whisper 服务的基础功能

#### 24.1 启动 Whisper 服务

```bash
cd whisper-api
venv\Scripts\activate  # Windows
python app.py
```

**期望输出**:
```
* Serving Flask app 'app'
* Debug mode: off
INFO:werkzeug:WARNING: This is a development server.
INFO:app:使用设备: cuda (或 cpu)
INFO:app:加载 Whisper 模型: base
INFO:app:模型加载完成!
```

#### 24.2 健康检查测试

```bash
# 新开终端
curl http://localhost:5001/health
```

**期望响应**:
```json
{
  "status": "ok",
  "timestamp": "2025-11-12T11:53:00Z",
  "model": "base",
  "device": "cuda",
  "gpu_name": "NVIDIA GeForce RTX 3060",
  "model_loaded": true
}
```

**验证点**:
- [ ] HTTP 状态码 200
- [ ] status 为 "ok"
- [ ] model 为 "base"
- [ ] device 正确显示 "cuda" 或 "cpu"
- [ ] model_loaded 为 true

#### 24.3 音频转录测试

准备测试音频文件（test-audio.wav），内容为中文语音。

```bash
# 使用 curl 测试
curl -X POST http://localhost:5001/transcribe \
  -F "audio=@test-audio.wav"
```

**期望响应**:
```json
{
  "text": "转录的中文文本内容",
  "device": "cuda",
  "model": "base",
  "transcribe_time": 1.23
}
```

**验证点**:
- [ ] HTTP 状态码 200
- [ ] text 字段包含转录文本
- [ ] device 字段正确
- [ ] transcribe_time 合理（通常 < 10秒）

#### 24.4 错误处理测试

**测试场景 1: 无音频文件**
```bash
curl -X POST http://localhost:5001/transcribe
```
**期望**: 400 错误 + 错误描述

**测试场景 2: 并发限制**
```bash
# 同时发送 4 个请求（并发限制为 3）
for i in {1..4}; do curl -X POST http://localhost:5001/transcribe -F "audio=@test.wav" & done
```
**期望**: 第 4 个请求返回 503 Service Busy

**验证点**:
- [ ] 无文件返回 400
- [ ] 并发超限返回 503
- [ ] 错误响应包含 error、error_type、suggestion 字段

---

### Task 25: Node.js 后端集成测试 ✓

**测试目标**: 验证 Node.js 后端与 Whisper 服务的集成

#### 25.1 启动 Node.js 后端

```bash
# 确保 Whisper 服务在运行
# 新开终端
npm run dev
```

**期望输出**:
```
Server running on port 5000
MongoDB connected
```

#### 25.2 Whisper 状态查询测试

```bash
# 需要先获取 JWT token (登录)
# 假设 token 为 YOUR_TOKEN

curl http://localhost:5000/api/audio/whisper-status \
  -H "x-auth-token: YOUR_TOKEN"
```

**期望响应**:
```json
{
  "status": "healthy",
  "isDegraded": false,
  "failureCount": 0,
  "maxFailures": 3,
  "whisperApiUrl": "http://localhost:5001"
}
```

**验证点**:
- [ ] HTTP 状态码 200
- [ ] status 为 "healthy"
- [ ] isDegraded 为 false
- [ ] failureCount 为 0

#### 25.3 本地转录集成测试

```bash
curl -X POST http://localhost:5000/api/audio/transcribe-local \
  -H "x-auth-token: YOUR_TOKEN" \
  -F "audio=@test-audio.wav" \
  -F "knowledgePointId=test123" \
  -F "durationSeconds=5"
```

**期望响应**:
```json
{
  "text": "转录的文本内容",
  "device": "cuda",
  "model": "base",
  "transcribe_time": 1.23,
  "total_time": 1.5
}
```

**验证点**:
- [ ] HTTP 状态码 200
- [ ] text 字段正确
- [ ] total_time > transcribe_time（包含网络传输）
- [ ] Node.js 日志显示 "使用 Whisper 进行转录"

#### 25.4 错误处理和降级测试

**测试场景 1: Whisper 服务未启动**
```bash
# 1. 停止 Whisper 服务 (Ctrl+C)
# 2. 调用 transcribe-local
curl -X POST http://localhost:5000/api/audio/transcribe-local \
  -H "x-auth-token: YOUR_TOKEN" \
  -F "audio=@test.wav"
```

**期望响应**:
```json
{
  "msg": "Whisper 服务不可用",
  "error": "Whisper API 服务未启动或无法连接",
  "suggestion": "请检查 Whisper 服务是否在运行 (http://localhost:5001)",
  "errorType": "SERVICE_UNAVAILABLE",
  "degradationStatus": {
    "isDegraded": false,
    "failureCount": 1,
    "maxFailures": 3
  }
}
```

**验证点**:
- [ ] HTTP 状态码 503
- [ ] errorType 为 "SERVICE_UNAVAILABLE"
- [ ] failureCount 增加
- [ ] suggestion 字段有帮助信息

**测试场景 2: 连续失败 3 次触发降级**
```bash
# 连续发送 3 次请求（Whisper 服务关闭状态）
for i in {1..3}; do
  curl -X POST http://localhost:5000/api/audio/transcribe-local \
    -H "x-auth-token: YOUR_TOKEN" \
    -F "audio=@test.wav"
  echo "\n--- Request $i ---\n"
done
```

**期望**: 第 3 次后，failureCount 达到 3，但不会自动切换 API（后端只记录状态）

**验证点**:
- [ ] 第 1 次: failureCount = 1
- [ ] 第 2 次: failureCount = 2
- [ ] 第 3 次: failureCount = 3，suggestion 提示已降级

---

### Task 26: React 前端端到端测试 ✓

**测试目标**: 验证前端 UI 和用户交互流程

#### 26.1 启动前端应用

```bash
cd ..\feynman-platform-frontend
npm run dev
```

访问 http://localhost:5173

#### 26.2 转录方式选择测试

**步骤**:
1. 登录应用
2. 进入知识点复述页面
3. 查看录音组件

**验证点**:
- [ ] 显示 "转录方式:" 选择器
- [ ] 两个按钮: "🖥️ 本地 Whisper" 和 "☁️ 百度 API"
- [ ] 默认选中 Whisper（蓝底高亮）
- [ ] 点击切换按钮，高亮状态正确切换
- [ ] localStorage 正确保存选择

**浏览器控制台验证**:
```javascript
// 检查 localStorage
localStorage.getItem('transcriptionMethod')  // 应显示 'whisper' 或 'baidu'
```

#### 26.3 Whisper 录音转录测试

**步骤**:
1. 选择 "本地 Whisper"
2. 点击 "开始录音"
3. 说一段中文（如："这是费曼学习法的核心概念"）
4. 点击 "停止录音"
5. 等待转录完成

**验证点**:
- [ ] 录音时显示计时器
- [ ] 停止后显示 "🖥️ 使用本地 Whisper 转录中..."
- [ ] 转录成功后文本框显示识别结果
- [ ] 控制台日志显示: `[VoiceRecorder] 使用 Whisper 进行转录 -> /audio/transcribe-local`
- [ ] 成功后无警告提示

#### 26.4 自动降级测试

**步骤**:
1. 停止 Whisper 服务（后端继续运行）
2. 前端选择 "本地 Whisper"
3. 录制音频并停止（第 1 次）
4. 观察错误提示
5. 重复步骤 3 两次（第 2、3 次）

**验证点**:
- [ ] 第 1 次失败: 显示 "⚠️ 本地 Whisper 已失败 1 次，连续失败 3 次将自动切换至百度 API"
- [ ] 第 2 次失败: 显示 "已失败 2 次"
- [ ] 第 3 次失败: 自动切换到 "☁️ 百度 API" 按钮高亮
- [ ] localStorage 自动更新为 'baidu'
- [ ] 控制台显示警告: "Whisper 连续失败 3 次，自动切换到百度 API"

#### 26.5 恢复测试

**步骤**:
1. 重启 Whisper 服务
2. 前端手动切换回 "本地 Whisper"
3. 录制并转录音频

**验证点**:
- [ ] 转录成功
- [ ] 失败计数重置为 0
- [ ] 警告提示消失

---

### Task 27: 完整流程验证 ✓

**测试目标**: 端到端完整用户流程

#### 27.1 完整学习流程

**步骤**:
1. 启动所有服务 (start-all.bat)
2. 用户注册/登录
3. 创建知识点 "费曼学习法的四个步骤"
4. 进入复述页面
5. 选择 "本地 Whisper"
6. 录制复述音频（30秒-1分钟）
7. 提交并等待 AI 评价
8. 查看评价结果

**验证点**:
- [ ] 所有服务正常启动
- [ ] 用户认证流程正常
- [ ] 知识点创建成功
- [ ] Whisper 转录成功
- [ ] AI 评价返回结果（polishedText, evaluation, score）
- [ ] 前端正确显示评价

#### 27.2 双模式对比测试

**步骤**:
1. 录制相同内容音频两次
2. 第一次使用 Whisper
3. 第二次使用百度 API
4. 对比转录结果和耗时

**验证点**:
- [ ] 两种方式都能成功转录
- [ ] Whisper 转录时间通常更快（GPU模式）
- [ ] 转录准确率相近
- [ ] 控制台日志正确显示不同端点

---

### Task 28: 性能和稳定性测试 ✓

**测试目标**: 验证系统性能和边界条件

#### 28.1 并发测试

**准备**: 创建测试脚本 `test-concurrent.sh`

```bash
#!/bin/bash
# 同时发送 5 个转录请求
for i in {1..5}; do
  curl -X POST http://localhost:5001/transcribe \
    -F "audio=@test.wav" \
    -o "response-$i.json" &
done
wait
echo "所有请求完成"
```

**验证点**:
- [ ] 前 3 个请求正常处理
- [ ] 第 4、5 个请求返回 503 Service Busy
- [ ] 服务不崩溃
- [ ] 日志显示并发限制生效

#### 28.2 大文件测试

**步骤**:
1. 准备 5 分钟长音频文件（~5MB）
2. 上传到 Whisper API

**验证点**:
- [ ] 转录成功完成
- [ ] 未触发超时（60秒）
- [ ] 临时文件正确清理

#### 28.3 错误恢复测试

**场景**: Whisper 服务中途崩溃

**步骤**:
1. 启动 Whisper 服务
2. 发送转录请求
3. 在转录过程中强制终止 Whisper 服务
4. 观察 Node.js 错误处理

**验证点**:
- [ ] Node.js 不崩溃
- [ ] 返回明确错误信息
- [ ] failureCount 正确增加

#### 28.4 内存泄漏测试

**步骤**:
1. 连续转录 20 个音频文件
2. 观察内存使用

**验证点**:
- [ ] 临时文件全部清理
- [ ] uploads/ 目录无残留文件
- [ ] 内存使用稳定，无持续增长

---

## 测试报告模板

完成测试后，填写以下报告：

```markdown
# Whisper 本地转录功能测试报告

**测试日期**: 2025-11-12
**测试人员**: [Your Name]
**测试环境**: Windows 11, RTX 3060, 16GB RAM

## 测试结果汇总

| 任务 | 测试项 | 通过/失败 | 备注 |
|------|--------|-----------|------|
| Task 24 | Whisper API 启动 | ✅/❌ | |
| Task 24 | 健康检查 | ✅/❌ | |
| Task 24 | 音频转录 | ✅/❌ | |
| Task 25 | Node.js 集成 | ✅/❌ | |
| Task 25 | 错误处理 | ✅/❌ | |
| Task 26 | 前端 UI | ✅/❌ | |
| Task 26 | 自动降级 | ✅/❌ | |
| Task 27 | 完整流程 | ✅/❌ | |
| Task 28 | 性能测试 | ✅/❌ | |

## 发现的问题

1. [问题描述]
   - 重现步骤: ...
   - 期望行为: ...
   - 实际行为: ...
   - 严重程度: High/Medium/Low

## 性能数据

- **Whisper 转录速度** (1分钟音频):
  - GPU 模式: ___ 秒
  - CPU 模式: ___ 秒
- **端到端延迟** (录音→转录→显示): ___ 秒
- **并发处理**: 最多 3 个请求同时处理 ✅

## 建议

1. [改进建议]
2. [优化建议]

## 结论

- [ ] 所有关键功能测试通过
- [ ] 发现 ___ 个严重问题
- [ ] 发现 ___ 个一般问题
- [ ] 建议 上线 / 修复后上线
```

---

## 快速测试脚本

保存为 `quick-test.bat`:

```batch
@echo off
echo ========================================
echo   Whisper 功能快速测试
echo ========================================

REM 检查服务
echo [1/4] 检查 Whisper 服务...
curl -s http://localhost:5001/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Whisper 服务未启动
    exit /b 1
)
echo ✅ Whisper 服务正常

echo [2/4] 检查 Node.js 服务...
curl -s http://localhost:5000/api/health >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js 服务未启动
    exit /b 1
)
echo ✅ Node.js 服务正常

echo [3/4] 测试 Whisper 健康检查...
curl http://localhost:5001/health
echo.

echo [4/4] 测试完成！
echo 所有服务运行正常，可以开始手动测试。
pause
```

---

## 附录：测试音频文件

创建测试音频的方法：

1. **Windows 录音机**: 录制 5-10 秒中文语音，保存为 WAV
2. **在线 TTS**: 使用百度 TTS 或 Edge TTS 生成测试音频
3. **示例文本**: "费曼学习法是一种通过教授他人来巩固知识的学习方法"

---

**文档版本**: 1.0  
**最后更新**: 2025-11-12
