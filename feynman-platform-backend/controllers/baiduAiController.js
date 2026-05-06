/**
 * controllers/baiduAiController.js
 * 
 * 说明：
 * - 统一管理与百度相关的 AI 能力：语音识别(ASR)、大模型调用(千帆 v2)、RAG 问答。
 * - 同时包含针对 LLM 返回 JSON 的健壮解析与格式校验逻辑，避免下游崩溃。
 * - 对 ffmpeg 的查找与配置做了多重兜底，便于在不同环境中直接运行。
 */

const fs = require('fs');
const path = require('path');
const { execFile, spawnSync, spawn } = require('child_process');

// 尝试确定 ffmpeg 可执行文件路径：优先工作区内捆绑二进制 > 环境变量 > ffmpeg-static > PATH
let ffmpegPath;

function canRunFfmpeg(candidate) {
  try {
    const result = spawnSync(candidate, ['-version'], { windowsHide: true, encoding: 'utf8' });
    return result.status === 0;
  } catch (error) {
    return false;
  }
}

const bundledCandidates = [
  // 1) 工作区根目录下的 ffmpeg 包（当前项目结构）
  path.join(
    __dirname,
    '..',
    '..',
    'ffmpeg-8.0-essentials_build',
    'ffmpeg-8.0-essentials_build',
    'bin',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  ),
  // 2) 后端目录下的 ffmpeg 包（兼容旧结构）
  path.join(
    __dirname,
    '..',
    'ffmpeg-8.0-essentials_build',
    'ffmpeg-8.0-essentials_build',
    'bin',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  ),
];

for (const candidate of bundledCandidates) {
  if (fs.existsSync(candidate) && canRunFfmpeg(candidate)) {
    ffmpegPath = candidate;
    break;
  }
}

if (!ffmpegPath && process.env.FFMPEG_PATH && canRunFfmpeg(process.env.FFMPEG_PATH)) {
  ffmpegPath = process.env.FFMPEG_PATH;
}

if (!ffmpegPath) {
  try {
    const installerPath = require('@ffmpeg-installer/ffmpeg').path;
    if (installerPath && fs.existsSync(installerPath) && canRunFfmpeg(installerPath)) {
      ffmpegPath = installerPath;
    }
  } catch (error) {
    ffmpegPath = undefined;
  }
}

if (!ffmpegPath) {
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && fs.existsSync(staticPath) && canRunFfmpeg(staticPath)) {
      ffmpegPath = staticPath;
    }
  } catch (error) {
    ffmpegPath = undefined;
  }
}

if (!ffmpegPath && canRunFfmpeg('ffmpeg')) {
  ffmpegPath = 'ffmpeg';
}

if (ffmpegPath) {
  console.log('✅ 使用 ffmpeg 可执行文件:', ffmpegPath);
} else {
  console.warn('⚠️ 未找到可执行的 ffmpeg。请安装 ffmpeg，或设置环境变量 FFMPEG_PATH 指向有效 ffmpeg.exe。');
}

function resampleTo16kMono(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ffmpegBin = ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';
    const args = ['-y', '-i', inputPath, '-ac', '1', '-ar', '16000', outputPath];

    console.log(`🔧 执行 ffmpeg: ${ffmpegBin}`);
    console.log(`📋 参数: ${args.join(' ')}`);

    // 使用 spawn 替代 execFile，添加 shell: true 以兼容 Git Bash 环境
    const ffmpegProcess = spawn(ffmpegBin, args, {
      shell: true,
      windowsHide: true
    });

    let stderr = '';
    let stdout = '';

    ffmpegProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffmpegProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffmpegProcess.on('error', (error) => {
      const hint = '请检查 ffmpeg 是否可执行（路径/权限），或设置环境变量 FFMPEG_PATH 指向 ffmpeg.exe。';
      return reject(new Error(`ffmpeg spawn error: ${error.message}. ${hint}`));
    });

    ffmpegProcess.on('close', (code) => {
      if (code !== 0) {
        const hint = '请检查 ffmpeg 是否可执行（路径/权限），或设置环境变量 FFMPEG_PATH 指向 ffmpeg.exe。';
        const details = stderr || stdout || `Exit code: ${code}`;
        return reject(new Error(`ffmpeg execution failed: ${details}. ${hint}`));
      }
      resolve();
    });
  });
}

const { v4: uuidv4 } = require('uuid');
const AipSpeechClient = require('baidu-aip-sdk').speech;
const axios = require('axios');
const KnowledgePoint = require('../models/KnowledgePoint');
const FeynmanAttempt = require('../models/FeynmanAttempt');

// ==================== RAG 相关导入 ====================
const { PromptTemplate } = require("@langchain/core/prompts");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { RunnableSequence, RunnableLambda } = require("@langchain/core/runnables");
const { HNSWLib } = require("@langchain/community/vectorstores/hnswlib");
const { HumanMessage } = require("@langchain/core/messages");

// 从 vectorStoreService 导入修复后的 embeddings 和路径
// 注意：vectorStoreService 中已经修复了 CJS/ESM 双实例问题，确保镜像生效
const { embeddings, VECTOR_STORE_PATH } = require('../services/vectorStoreService');

/**
 * 带重试和相似度过滤的 RAG 检索
 * - 遇到 QPS/RPM 限流时指数退避重试
 * - 使用相似度阈值过滤不相关文档
 * @param {Object} vectorStore - 向量库实例
 * @param {string} question - 用户问题
 * @param {number} k - 检索文档数量（默认 5）
 * @param {number} similarityThreshold - 相似度阈值 0-1（默认 0.5，越高越严格）
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise<Array>} 相关文档数组
 */
async function retrieveWithRetry(vectorStore, question, k = 5, similarityThreshold = 0.5, maxRetries = 4) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 使用 similaritySearchWithScore 获取相似度分数
      const results = await vectorStore.similaritySearchWithScore(question, k);

      // 过滤掉相似度低于阈值的文档
      // 注意：HNSWLib 返回的是距离（越小越相似），需要转换为相似度
      // 相似度 = 1 / (1 + 距离)
      const filteredDocs = results
        .map(([doc, distance]) => ({
          doc,
          similarity: 1 / (1 + distance)
        }))
        .filter(({ similarity }) => similarity >= similarityThreshold)
        .map(({ doc }) => doc);

      console.log(`[RAG] 检索到 ${results.length} 个文档，过滤后保留 ${filteredDocs.length} 个（阈值: ${similarityThreshold}）`);

      // 如果过滤后没有文档，降低阈值重试一次
      if (filteredDocs.length === 0 && similarityThreshold > 0.3) {
        console.log(`[RAG] 无相关文档，降低阈值到 0.3 重试...`);
        return await retrieveWithRetry(vectorStore, question, k, 0.3, 1);
      }

      return filteredDocs;
    } catch (e) {
      const isRateLimit = e.message && (
        e.message.includes('qps') ||
        e.message.includes('rate') ||
        e.message.includes('limit') ||
        e.message.includes('18') ||
        e.message.includes('336501')
      );
      if (isRateLimit && attempt < maxRetries) {
        const delay = attempt * 5000; // 5s, 10s, 15s
        console.log(`[RAG] Embedding API 限流，${delay / 1000}秒后重试 (${attempt}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw e;
      }
    }
  }
}

// 初始化百度语音识别客户端（需 .env 提供 BAIDU_*）
const client = new AipSpeechClient(
  process.env.BAIDU_APP_ID,
  process.env.BAIDU_API_KEY,
  process.env.BAIDU_SECRET_KEY
);

// ==================== 千帆大模型 - Token 管理 ====================

// 简单的内存 Token 缓存，避免每次请求都去拉取新 Token
let tokenCache = { token: null, expiresAt: 0 };

/**
 * 获取百度千帆 OAuth Token（基于 BAIDU_API_KEY/BAIDU_SECRET_KEY）
 * - 有效期前 5 分钟提前刷新
 */
async function getQianfanBearerToken() {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt) {
    console.log('✨ 使用缓存的Token');
    return tokenCache.token;
  }

  console.log('🔑 获取新的OAuth Token...');
  const apiKey = process.env.BAIDU_API_KEY;
  const secretKey = process.env.BAIDU_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('缺少BAIDU_API_KEY或BAIDU_SECRET_KEY配置');
  }

  try {
    const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
    const response = await axios.get(tokenUrl);
    const { access_token, expires_in } = response.data;

    tokenCache.token = access_token;
    tokenCache.expiresAt = now + (expires_in - 300) * 1000; // 提前 5 分钟刷新

    console.log('✅ OAuth Token获取成功');
    return access_token;
  } catch (error) {
    console.error('❌ 获取OAuth Token失败:', error.response?.data || error.message);
    throw new Error('获取OAuth Token失败');
  }
}

/**
 * 构建“先润色后评价”的 Prompt
 * - 目标：鼓励学生表达、给出建设性反馈、并量化评分
 */
function buildEvaluationPrompt(originalContent, transcribedText) {
  return `你是一个严格而客观的计算机科学学习教练。你的任务是评估学生对知识点的复述质量。

【原始知识点】:
\`\`\`
${originalContent}
\`\`\`

【学生的复述文本】:
\`\`\`
${transcribedText}
\`\`\`

---

## 评估任务

### 1. 文本润色
将复述文本润色成专业、书面化的表达：
- 修正语法错误、口语化表达和逻辑不清的地方
- **保留学生的核心观点和用词**，不添加原文没有的内容
- **如果原文已经很好**，只需微调或保持原样

### 2. 综合评价
基于原始知识点，给出客观、具体的反馈：
- 指出学生理解正确的部分
- 指出实际存在的遗漏或错误（**不要编造不存在的问题**）
- 给出改进建议（具体、可执行）

### 3. 评分标准（0-100分）

**维度权重**：
- 准确性（40%）：核心概念是否正确
- 完整性（30%）：关键要点是否遗漏
- 逻辑性（20%）：表达是否清晰连贯
- 流畅性（10%）：语言是否流畅自然

**分数档位**：
- **90-100分**：核心概念完全正确，要点齐全，逻辑清晰，表达流畅
- **75-89分**：核心概念正确，大部分要点覆盖，小缺陷不影响理解
- **60-74分**：核心概念基本正确，但有明显遗漏或逻辑不清
- **45-59分**：部分概念正确，但关键要点遗漏较多或有错误
- **0-44分**：核心概念错误或严重遗漏，需要重新学习

**重要原则**：
1. **准确复述 ≠ 机械重复**：
   - 如果学生用自己的话表达了所有核心要点，即使用词接近原文，也应给高分（85+）
   - 如果复述与原文逐字逐句完全一致（像背读），且没有任何自己的理解或例子，分数 70-80
   - 如果只是抽取原文关键词而无逻辑连接，分数 50-60
2. **错误严重度**：
   - 核心概念错误 → 分数不超过60分
   - 复述与原文主题完全无关 → 0分
3. **鼓励理解深度**：
   - 如能结合自己的例子、类比或应用场景，加分（最多+5分）

**评分示例**：
- 原文：“闭包是函数及其引用环境的组合”
  - 复述A：“闭包就是函数和它引用的环境组合在一起” → **90分**（准确，用自己的话）
  - 复述B：“闭包是函数及其引用环境的组合” → **75分**（完全相同，但准确）
  - 复述C：“闭包 函数 环境” → **55分**（只有关键词，无逻辑）
  - 复述D：“闭包是JS的一种特殊语法” → **45分**（概念错误）

---

**输出JSON格式**（严格遵守，不要添加markdown或额外文字）：

{
  "polishedText": "润色后的文本（如无需改进可保持原样）",
  "evaluation": "综合评价（2-3句话）",
  "strengths": ["实际优点1", "实际优点2"],
  "weaknesses": ["实际存在的问题1", "实际存在的问题2"],
  "score": 75
}

**关键要求**：
- strengths 和 weaknesses **必须基于实际内容**，不能编造
- 如果复述已经非常好，可以只有 strengths 而 weaknesses 为空数组：\`"weaknesses": []\`
- 如果没有明显优点，也可以 strengths 为空数组：\`"strengths": []\``;
}

/**
 * 验证大模型返回 JSON 的结构是否符合预期
 * - 防止后续访问字段时报错
 */
function validateEvaluationResult(result) {
  return (
    result &&
    typeof result.polishedText === 'string' &&
    typeof result.evaluation === 'string' &&
    Array.isArray(result.strengths) &&
    Array.isArray(result.weaknesses) &&
    typeof result.score === 'number' &&
    result.score >= 0 &&
    result.score <= 100
  );
}

/**
 * AI评价费曼复述
 * 支持两种调用方式：
 * 1) 通过 knowledgePointId 自动读取知识点原文作为标准答案（推荐）
 * 2) 直接传 originalContent 文本（兼容旧版本）
 * @returns {Object} AI评价结果
 */
/**
 * AI 评价费曼复述
 * 支持：
 *  - knowledgePointId（推荐）：以数据库原文为标准答案
 *  - originalContent（兼容旧版）：直接传入标准答案
 */
exports.evaluateFeynmanAttempt = async (req, res) => {
  let { originalContent, transcribedText, knowledgePointId, attemptId } = req.body || {};

  // 1. 基本参数校验（transcribedText 必填）
  if (!transcribedText || typeof transcribedText !== 'string' || !transcribedText.trim()) {
    return res.status(400).json({ msg: 'transcribedText is required and must be a non-empty string' });
  }

  // 2. 如果提供了 knowledgePointId，则以数据库中的原文作为标准答案
  let resolvedKpId = null;
  if (knowledgePointId) {
    try {
      const kp = await KnowledgePoint.findById(knowledgePointId);
      if (!kp) {
        return res.status(404).json({ msg: 'Knowledge point not found' });
      }
      // 权限校验：只能评价自己的知识点
      if (kp.author.toString() !== req.user.id) {
        return res.status(403).json({ msg: 'Not authorized to evaluate this knowledge point' });
      }
      originalContent = kp.content || '';
      resolvedKpId = kp._id.toString();
    } catch (e) {
      return res.status(400).json({ msg: 'Invalid knowledgePointId' });
    }
  }

  // 3. 如果未提供 knowledgePointId，则要求 originalContent 必填（兼容旧接口）
  if ((!originalContent || typeof originalContent !== 'string') && !knowledgePointId) {
    return res.status(400).json({ msg: 'originalContent is required when knowledgePointId is not provided' });
  }

  // 4. 长度限制（防止恶意攻击）
  originalContent = String(originalContent || '').trim();
  transcribedText = String(transcribedText).trim();
  if (originalContent.length > 10000) {
    return res.status(400).json({ msg: 'originalContent too long (max 10000 characters)' });
  }
  if (transcribedText.length > 5000) {
    return res.status(400).json({ msg: 'transcribedText too long (max 5000 characters)' });
  }

  try {
    console.log('🤖 开始AI评价...');

    // 开发模式: 如果BAIDU_API_KEY没有大模型权限，使用mock响应
    if (process.env.NODE_ENV === 'development' || process.env.USE_MOCK_AI === 'true') {
      console.log('🧪 使用Mock响应（开发模式）');
      const mockResult = {
        polishedText: `${transcribedText}（已润色）`,
        evaluation: `您对知识点的理解基本准确，能够抓住核心概念。建议增加更多细节和例子来丰富您的表述。`,
        strengths: [
          '核心概念表述清晰',
          '逻辑结构合理'
        ],
        weaknesses: [
          '可以增加更多实际示例',
          '部分细节可以进一步完善'
        ],
        score: Math.floor(60 + Math.random() * 30) // 60-90分
      };
      return res.json({
        ...mockResult,
        standardAnswer: originalContent,
        knowledgePointId: resolvedKpId || knowledgePointId || null,
        source: knowledgePointId ? 'knowledgePoint' : 'raw'
      });
    }

    // 5. 获取API Key (使用 DeepSeek)
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('缺少DEEPSEEK_API_KEY配置');
    }

    // 6. 构建API URL (DeepSeek API)
    const apiUrl = 'https://api.deepseek.com/chat/completions';

    // 7. 设计Prompt（同时要求”先润色后评价”）
    const prompt = buildEvaluationPrompt(originalContent, transcribedText);

    // 8. 调用大模型API (DeepSeek)
    console.log('📤 调用 DeepSeek API (deepseek-chat)...');
    console.log('📝 原始内容长度:', originalContent.length, '字符');
    console.log('📝 复述文本长度:', transcribedText.length, '字符');

    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,  // 降低随机性，提升评分一致性
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 30000
    });

    // 9. 解析响应 (DeepSeek 格式: choices[0].message.content)
    const llmResultText = response.data.choices?.[0]?.message?.content;
    console.log('📝 大模型原始返回:', llmResultText);

    let llmResult;
    try {
      // 尝试直接解析
      llmResult = JSON.parse(llmResultText);
    } catch (parseError) {
      console.log('⚠️ 直接解析失败，尝试提取JSON...');

      // 尝试从json代码块中提取
      const jsonMatch = llmResultText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          llmResult = JSON.parse(jsonMatch[1].trim());
          console.log('✅ 从代码块中成功提取JSON');
        } catch (e) {
          console.error('❌ 代码块解析失败');
        }
      }

      // 如果还是失败，尝试找到第一个{和最后一个}
      if (!llmResult) {
        const firstBrace = llmResultText.indexOf('{');
        const lastBrace = llmResultText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            const jsonStr = llmResultText.substring(firstBrace, lastBrace + 1);
            llmResult = JSON.parse(jsonStr);
            console.log('✅ 通过大括号匹配成功提取JSON');
          } catch (e) {
            console.error('❌ 大括号匹配解析失败');
          }
        }
      }

      // 如果所有尝试都失败
      if (!llmResult) {
        console.error('❌ 所有JSON解析尝试均失败');
        console.error('原始文本:', llmResultText);
        return res.status(500).json({ 
          msg: 'Failed to parse AI response',
          error: 'Invalid JSON format from AI model',
          rawResponse: llmResultText.substring(0, 500) // 返回前500字符供调试
        });
      }
    }

    // 10. 验证结果格式
    if (!validateEvaluationResult(llmResult)) {
      console.error('❌ 评价结果格式无效');
      return res.status(500).json({ 
        msg: 'Invalid AI evaluation result format',
        error: 'Missing required fields or invalid data types'
      });
    }

    console.log(`✅ AI评价完成，得分: ${llmResult.score}`);

    // 可选：回写AI结果到 Attempt 记录
    if (attemptId) {
      try {
        const attempt = await FeynmanAttempt.findById(attemptId);
        if (attempt && attempt.author.toString() === req.user.id) {
          const strengthsText = (llmResult.strengths || []).map(s => `- ${s}`).join('\n');
          const weaknessesText = (llmResult.weaknesses || []).map(w => `- ${w}`).join('\n');
          const combinedFeedback = `${llmResult.evaluation}${strengthsText ? `\n\n优点:\n${strengthsText}` : ''}${weaknessesText ? `\n\n待改进:\n${weaknessesText}` : ''}`;
          attempt.polishedText = llmResult.polishedText || '';
          attempt.score = typeof llmResult.score === 'number' ? llmResult.score : attempt.score;
          attempt.feedback = combinedFeedback;
          attempt.standardAnswer = originalContent;
          await attempt.save();
          console.log(`📝 已回写AI结果到Attempt ${attemptId}`);
        }
      } catch (e) {
        console.warn('⚠️ 回写AI结果到Attempt失败:', e.message);
      }
    }
    
    // 11. 返回结果（附带标准答案来源）
    res.json({
      ...llmResult,
      standardAnswer: originalContent,
      knowledgePointId: resolvedKpId || knowledgePointId || null,
      source: knowledgePointId ? 'knowledgePoint' : 'raw'
    });

  } catch (error) {
    console.error('❌ AI评价失败:', error.response?.data || error.message);

    // 区分不同错误类型
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ msg: 'AI evaluation timeout' });
    }

    res.status(500).json({ 
      msg: 'AI evaluation failed',
      error: error.message 
    });
  }
};

// ==================== 语音识别相关 ====================

/**
 * 转写音频主函数
 */
/**
 * 语音转写主流程
 * - 保存临时文件 -> ffmpeg 重采样 -> 调用百度 ASR -> 清理临时文件
 */
exports.transcribeAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未收到音频文件' });
    }

    console.log(`🎧 收到音频文件: ${req.file.originalname || 'buffer'} (${req.file.size} bytes)`);

    // 1️⃣ 临时保存音频文件
    const tmpDir = path.join(__dirname, '../tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const inputPath = path.join(tmpDir, `${uuidv4()}_input.wav`);
    const outputPath = path.join(tmpDir, `${uuidv4()}_16k.wav`);
    await fs.promises.writeFile(inputPath, req.file.buffer);

    console.log(`📦 临时文件已保存: ${inputPath}`);

    // 2️⃣ 使用 ffmpeg 重采样为 16kHz、单声道
    console.log('⚙️ 正在重采样为 16kHz 单声道...');

    await resampleTo16kMono(inputPath, outputPath);
    console.log('✅ 重采样完成');

    // 3️⃣ 读取转换后的音频 Buffer
    const convertedBuffer = await fs.promises.readFile(outputPath);
    console.log(`🎯 转换后文件大小: ${(convertedBuffer.length / 1024).toFixed(2)} KB`);

    // 4️⃣ 调用百度语音识别
    const devPid = 1537; // 普通话（输入法模型）
    console.log(`🎙️ 调用百度ASR (dev_pid=${devPid})...`);

    const result = await client.recognize(convertedBuffer, 'wav', 16000, {
      dev_pid: devPid,
      ptt: 1, // 是否开启标点
    });

    console.log('📝 百度ASR返回结果:');
    console.log(JSON.stringify(result, null, 2));

    // 5️⃣ 清理临时文件
    try {
      fs.unlinkSync(inputPath);
      fs.unlinkSync(outputPath);
    } catch (cleanupErr) {
      console.warn('⚠️ 清理临时文件失败:', cleanupErr.message);
    }

    // 6️⃣ 返回识别结果
    if (result.err_no === 0) {
      res.json({
        success: true,
        text: result.result.join(''),
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.err_msg,
        err_no: result.err_no,
      });
    }
  } catch (err) {
    console.error('❌ 语音识别失败:', err);
    res.status(500).json({
      success: false,
      message: '语音识别失败',
      error: err.message,
    });
  }
};

// ==================== AI出题相关 ====================

/**
 * 构建单选题生成Prompt
 * @param {string} content - 知识点内容
 * @param {string} difficulty - 难度（基础/中等/困难）
 * @returns {string} Prompt字符串
 */
/**
 * 构建单选题 Prompt
 */
function buildSingleChoicePrompt(content, difficulty) {
  return `你是一个专业的计算机科学出题专家。请根据以下提供的知识点内容和指定的难度，生成一个相关的单项选择题。

【知识点内容】:
"""
${content}
"""

【指定难度】: ${difficulty}

请严格按照以下JSON格式返回题目，不要包含任何额外的解释或文字，确保所有字段都存在。
{
  "type": "single-choice",
  "difficulty": "${difficulty}",
  "question": "这里是题干",
  "options": {
    "A": "选项A的内容",
    "B": "选项B的内容",
    "C": "选项C的内容",
    "D": "选项D的内容"
  },
  "answer": "C",
  "explanation": "这里是对正确答案的简短解释"
}`;
}

/**
 * 构建简答题生成Prompt
 * @param {string} content - 知识点内容
 * @param {string} difficulty - 难度（基础/中等/困难）
 * @returns {string} Prompt字符串
 */
/**
 * 构建简答题 Prompt
 */
function buildShortAnswerPrompt(content, difficulty) {
  return `你是一个专业的计算机科学出题专家。请根据以下提供的知识点内容和指定的难度，生成一个相关的简答题。

【知识点内容】:
"""
${content}
"""

【指定难度】: ${difficulty}

请严格按照以下JSON格式返回题目，不要包含任何额外的解释或文字，确保所有字段都存在。
{
  "type": "short-answer",
  "difficulty": "${difficulty}",
  "question": "这里是题干，要求学生用自己的话解释某个概念或描述某个过程",
  "answer_key_points": [
    "关键点1：必须提及的核心概念",
    "关键点2：必须解释的重要过程",
    "关键点3：需要体现的理解深度"
  ],
  "reference_answer": "这里是一个参考答案示例，帮助学生理解题目要求"
}

注意：
- question 应该是开放性问题，让学生用自己的话回答
- answer_key_points 是评分时用来检查学生答案是否包含这些关键点的，应包含3-5个关键点
- reference_answer 是一个完整的示例答案，供学生参考`;
}

/**
 * 生成题目（单选题或简答题）
 * @route POST /api/ai/generate-question
 * @access Private
 * @param {Object} req.body
 *   - knowledgePointContent: string (必填, 知识点内容)
 *   - difficulty: string (必填, "基础"|"中等"|"困难")
 *   - type: string (可选, "single-choice"|"short-answer", 默认"single-choice")
 * @returns {Object} JSON格式题目
 */
/**
 * 生成题目（单选 / 简答）
 */
exports.generateQuestion = async (req, res) => {
  const { knowledgePointContent, difficulty, type = 'single-choice' } = req.body;

  // 1. 参数校验
  if (!knowledgePointContent || !difficulty) {
    return res.status(400).json({ msg: 'Knowledge point content and difficulty are required.' });
  }

  const validDifficulties = ['基础', '中等', '困难'];
  if (!validDifficulties.includes(difficulty)) {
    return res.status(400).json({ msg: 'Invalid difficulty value. Must be "基础", "中等", or "困难".' });
  }

  const validTypes = ['single-choice', 'short-answer'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ msg: 'Invalid question type. Must be "single-choice" or "short-answer".' });
  }

  // 2. 内容长度限制
  if (knowledgePointContent.length < 10) {
    return res.status(400).json({ msg: 'Knowledge point content too short (min 10 characters).' });
  }
  if (knowledgePointContent.length > 10000) {
    return res.status(400).json({ msg: 'Knowledge point content too long (max 10000 characters).' });
  }

  try {
    console.log(`🤖 生成${type === 'single-choice' ? '单选题' : '简答题'}，难度: ${difficulty}`);
    console.log(`📝 输入内容长度: ${knowledgePointContent.length} 字符`);

    // 3. 获取API Token
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('缺少DEEPSEEK_API_KEY配置');
    }

    // 4. 构建Prompt (根据题型)
    const prompt = type === 'single-choice'
      ? buildSingleChoicePrompt(knowledgePointContent, difficulty)
      : buildShortAnswerPrompt(knowledgePointContent, difficulty);

    // 5. 调用 DeepSeek API
    const apiUrl = 'https://api.deepseek.com/chat/completions';
    const startTime = Date.now();
    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 30000
    });
    const responseTime = Date.now() - startTime;
    console.log(`⏱️ API响应时间: ${responseTime}ms`);

    // 6. 解析响应
    const llmResultText = response.data.choices?.[0]?.message?.content;
    console.log('📝 AI返回:', llmResultText?.substring(0, 200));

    let questionData;
    try {
      // 3.3 实现AI响应JSON解析逻辑（3层容错）
      questionData = JSON.parse(llmResultText);
    } catch (parseError) {
      console.log('⚠️ 直接解析失败，尝试提取JSON...');

      // 尝试从```json```代码块中提取
      const jsonMatch = llmResultText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          questionData = JSON.parse(jsonMatch[1].trim());
          console.log('✅ 从代码块中成功提取JSON');
        } catch (e) {
          console.error('❌ 代码块解析失败');
        }
      }

      // 如果还是失败，尝试找到第一个{和最后一个}
      if (!questionData) {
        const firstBrace = llmResultText.indexOf('{');
        const lastBrace = llmResultText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            const jsonStr = llmResultText.substring(firstBrace, lastBrace + 1);
            questionData = JSON.parse(jsonStr);
            console.log('✅ 通过大括号匹配成功提取JSON');
          } catch (e) {
            console.error('❌ 大括号匹配解析失败');
          }
        }
      }

      // 如果所有尝试都失败
      if (!questionData) {
        console.error('❌ 所有JSON解析尝试均失败');
        console.error('原始文本:', llmResultText);
        return res.status(500).json({ 
          msg: 'AI返回格式错误，请稍后重试',
          error: 'Failed to parse AI response',
          rawResponse: llmResultText?.substring(0, 500)
        });
      }
    }

    // 3.4 实现返回格式验证
    if (type === 'single-choice') {
      if (!questionData.question || !questionData.options || !questionData.answer) {
        return res.status(500).json({ msg: 'AI返回格式不完整，缺少必要字段' });
      }
      if (!['A', 'B', 'C', 'D'].includes(questionData.answer)) {
        return res.status(500).json({ msg: 'AI返回的答案不合法，必须是A/B/C/D之一' });
      }
      const optionKeys = Object.keys(questionData.options || {});
      if (!['A', 'B', 'C', 'D'].every(key => optionKeys.includes(key))) {
        return res.status(500).json({ msg: 'AI返回的选项不完整，必须包含A/B/C/D' });
      }
    } else {
      // 简答题验证（后续实现）
      if (!questionData.question || !Array.isArray(questionData.answer_key_points)) {
        return res.status(500).json({ msg: 'AI返回格式不完整' });
      }
    }

    console.log(`✅ 题目生成成功`);
    res.json(questionData);

  } catch (error) {
    // 3.5 添加日志和错误处理
    console.error('❌ 生成题目失败:', error.response?.data || error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ msg: 'Question generation timeout' });
    }
    
    res.status(500).json({ 
      msg: 'Question generation failed',
      error: error.message 
    });
  }
};

/**
 * AI解析选择题答案
 * @route POST /api/ai/explain-choice
 * @access Private
 * @param {Object} req.body
 *   - question: string (必填, 题目内容)
 *   - options: object (必填, 选项 {A, B, C, D})
 *   - correctAnswer: string (必填, 正确答案 A/B/C/D)
 *   - userAnswer: string (必填, 学生答案 A/B/C/D)
 *   - originalExplanation: string (可选, AI生成题目时的原始解析)
 * @returns {Object} { isCorrect: boolean, correctExplanation: string, wrongExplanation: string, knowledgePoints: string }
 */
/**
 * 解析选择题答案与知识点
 */
exports.explainChoice = async (req, res) => {
  const { question, options, correctAnswer, userAnswer, originalExplanation } = req.body;

  // 1. 参数校验
  if (!question || !options || !correctAnswer || !userAnswer) {
    return res.status(400).json({ msg: 'Question, options, correctAnswer, and userAnswer are required.' });
  }

  if (!['A', 'B', 'C', 'D'].includes(correctAnswer) || !['A', 'B', 'C', 'D'].includes(userAnswer)) {
    return res.status(400).json({ msg: 'Answers must be A, B, C, or D.' });
  }

  const optionKeys = Object.keys(options || {});
  if (!['A', 'B', 'C', 'D'].every(key => optionKeys.includes(key))) {
    return res.status(400).json({ msg: 'Options must contain A, B, C, and D.' });
  }

  try {
    console.log('🎯 AI解析选择题答案...');
    console.log(`📝 题目: ${question.substring(0, 50)}...`);
    console.log(`👨‍🎓 学生答案: ${userAnswer} | 正确答案: ${correctAnswer}`);

    const isCorrect = userAnswer === correctAnswer;

    // 开发模式: 如果QIANFAN_ACCESS_KEY没有配置或启用Mock模式，使用mock响应
    if (process.env.NODE_ENV === 'development' || process.env.USE_MOCK_AI === 'true') {
      console.log('🧪 使用Mock响应（开发模式）');
      const mockResult = {
        isCorrect,
        userAnswer,
        correctAnswer,
        correctExplanation: `选项${correctAnswer}是正确答案。${originalExplanation || '这道题考查了核心概念的理解。'}正确选项符合题目要求，并且准确表达了相关知识点。`,
        wrongExplanation: isCorrect 
          ? '其他选项存在概念混淆或表述错误的问题。' 
          : `选项${userAnswer}是错误的。这可能是因为对核心概念理解不够深入，或者混淆了相似的概念。建议重新复习相关知识点，并注意区分相似概念的差异。`,
        knowledgePoints: '本题考查的核心知识点包括相关概念的定义、特点和应用场景。掌握这些知识点对于理解整个知识体系非常重要。'
      };
      return res.json(mockResult);
    }

    // 2. 获取API Token
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('缺少DEEPSEEK_API_KEY配置');
    }

    // 3. 构建Prompt
    const prompt = `你是一个专业的计算机科学教师。请对这道选择题进行详细解析，帮助学生理解答案。

【题目】:
${question}

【选项】:
A. ${options.A}
B. ${options.B}
C. ${options.C}
D. ${options.D}

【正确答案】: ${correctAnswer}
【学生答案】: ${userAnswer}
${originalExplanation ? `\n【出题时的解析】:\n${originalExplanation}` : ''}

请提供详细的解析，严格按照以下JSON格式返回，不要包含任何额外的解释或文字：
{
  "correctExplanation": "详细解释为什么选项${correctAnswer}是正确答案，包括：1) 核心知识点 2) 正确选项符合哪些条件 3) 如何判断这个选项正确",
  "wrongExplanation": "${isCorrect ? '（学生答对了，本字段可以简短说明其他选项为什么错）' : `详细解释为什么选项${userAnswer}是错误的，包括：1) 错在哪里 2) 常见误区 3) 如何避免这类错误`}",
  "knowledgePoints": "总结这道题考查的核心知识点，以及相关的概念、原理或应用场景"
}

要求：
1. **correctExplanation** (字符串，100字以上):
   - 必须清晰解释为什么正确答案是对的
   - 结合选项内容和题目背景
   - 帮助学生深入理解知识点

2. **wrongExplanation** (字符串):
   - 如果学生答对了：简短说明其他选项的错误（50字左右）
   - 如果学生答错了：详细分析学生选择的错误选项为什么错（100字以上）
   - 指出常见误区和思维陷阱

3. **knowledgePoints** (字符串，80字以上):
   - 总结题目涉及的核心概念
   - 可以扩展相关知识点
   - 帮助学生建立知识体系`;

    // 4. 调用 DeepSeek API
    const apiUrl = 'https://api.deepseek.com/chat/completions';
    const startTime = Date.now();
    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 30000
    });
    const responseTime = Date.now() - startTime;
    console.log(`⏱️ API响应时间: ${responseTime}ms`);

    // 5. 解析响应
    const llmResultText = response.data.choices?.[0]?.message?.content;
    console.log('📝 AI返回:', llmResultText?.substring(0, 200));

    let explanationData;
    try {
      explanationData = JSON.parse(llmResultText);
    } catch (parseError) {
      console.log('⚠️ 直接解析失败，尝试提取JSON...');

      // 尝试从```json```代码块中提取
      const jsonMatch = llmResultText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          explanationData = JSON.parse(jsonMatch[1].trim());
          console.log('✅ 从代码块中成功提取JSON');
        } catch (e) {
          console.error('❌ 代码块解析失败');
        }
      }

      // 如果还是失败，尝试找到第一个{和最后一个}
      if (!explanationData) {
        const firstBrace = llmResultText.indexOf('{');
        const lastBrace = llmResultText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            const jsonStr = llmResultText.substring(firstBrace, lastBrace + 1);
            explanationData = JSON.parse(jsonStr);
            console.log('✅ 通过大括号匹配成功提取JSON');
          } catch (e) {
            console.error('❌ 大括号匹配解析失败');
          }
        }
      }

      if (!explanationData) {
        console.error('❌ 所有JSON解析尝试均失败');
        console.error('原始文本:', llmResultText);
        return res.status(500).json({ 
          msg: 'AI返回格式错误，请稍后重试',
          error: 'Failed to parse AI response',
          rawResponse: llmResultText?.substring(0, 500)
        });
      }
    }

    // 6. 验证格式
    const requiredFields = ['correctExplanation', 'wrongExplanation', 'knowledgePoints'];
    const missingFields = requiredFields.filter(field => !explanationData[field]);
    
    if (missingFields.length > 0) {
      return res.status(500).json({ 
        msg: `AI返回格式不完整，缺少字段: ${missingFields.join(', ')}`,
        received: explanationData 
      });
    }

    // 验证字段类型
    if (typeof explanationData.correctExplanation !== 'string' ||
        typeof explanationData.wrongExplanation !== 'string' ||
        typeof explanationData.knowledgePoints !== 'string') {
      return res.status(500).json({ 
        msg: 'AI返回字段类型错误',
        received: explanationData
      });
    }

    // 验证内容长度
    if (explanationData.correctExplanation.trim().length < 30) {
      console.warn('⚠️ correctExplanation字段较短:', explanationData.correctExplanation.length, '字符');
    }
    if (explanationData.knowledgePoints.trim().length < 30) {
      console.warn('⚠️ knowledgePoints字段较短:', explanationData.knowledgePoints.length, '字符');
    }

    console.log(`✅ 解析完成: ${isCorrect ? '✅ 答对了' : '❌ 答错了'}`);
    
    res.json({
      isCorrect,
      userAnswer,
      correctAnswer,
      ...explanationData
    });

  } catch (error) {
    console.error('❌ 解析失败:', error.response?.data || error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ msg: 'Explanation timeout' });
    }
    
    res.status(500).json({ 
      msg: 'Explanation failed',
      error: error.message 
    });
  }
};

/**
 * AI评分简答题答案
 * @route POST /api/ai/grade-answer
 * @access Private
 * @param {Object} req.body
 *   - question: string (必填, 题目内容)
 *   - answerKeyPoints: array (必填, 关键点列表)
 *   - studentAnswer: string (必填, 学生答案)
 *   - knowledgePointId: string (可选, 知识点ID，用于记录)
 * @returns {Object} { isCorrect: boolean, score: number, feedback: string, explanation: string }
 */
/**
 * 评分简答题答案
 */
exports.gradeAnswer = async (req, res) => {
  const { question, answerKeyPoints, studentAnswer, knowledgePointId } = req.body;

  // 1. 参数校验
  if (!question || !answerKeyPoints || !studentAnswer) {
    return res.status(400).json({ msg: 'Question, answer key points, and student answer are required.' });
  }

  if (!Array.isArray(answerKeyPoints) || answerKeyPoints.length === 0) {
    return res.status(400).json({ msg: 'Answer key points must be a non-empty array.' });
  }

  if (studentAnswer.trim().length < 5) {
    return res.status(400).json({ msg: 'Student answer too short (min 5 characters).' });
  }

  try {
    console.log(`🧐 AI评分简答题...`);
    console.log(`📝 题目: ${question.substring(0, 50)}...`);
    console.log(`👨‍🎓 学生答案长度: ${studentAnswer.length} 字符`);

    // 2. 获取API Token
    const apiKey = process.env.QIANFAN_ACCESS_KEY;
    if (!apiKey) {
      throw new Error('缺少QIANFAN_ACCESS_KEY配置');
    }

    // 3. 构建Prompt
    const prompt = `你是一个专业的计算机科学教师和评分专家。请对学生的简答题答案进行详细评估。

【题目】:
${question}

【标准答案要点】:
${answerKeyPoints.map((kp, idx) => `${idx + 1}. ${kp}`).join('\n')}

【学生的回答】:
"""
${studentAnswer}
"""

请对学生答案进行全面评估，严格按照以下JSON格式返回，不要包含任何额外的解释或文字：
{
  "score": 85,
  "isCorrect": true,
  "analysis": "学生的回答展示了对核心概念的理解。正确指出了...[具体分析学生答案中正确和错误的部分]",
  "suggestions": "建议补充...的内容，可以进一步说明...[给出具体的改进建议]",
  "standardAnswer": "完整的标准答案应该包括：1) ... 2) ... 3) ...[提供一个完整、清晰的参考答案]"
}

评分标准：
1. **score** (0-100分):
   - 90-100分: 全面准确，覆盖所有关键点，表述清晰专业
   - 70-89分: 理解正确，覆盖大部分关键点，有小缺漏
   - 60-69分: 基本理解，覆盖部分关键点，但不够完整
   - 40-59分: 部分理解，关键点缺失较多
   - 0-39分: 理解有误或严重缺失关键内容

2. **isCorrect** (布尔值):
   - true: score >= 60 (及格)
   - false: score < 60 (不及格)

3. **analysis** (字符串，150字以上):
   - 详细分析学生答案的优点和不足
   - 明确指出哪些要点已覆盖、哪些缺失
   - 如有错误理解，具体说明错在哪里

4. **suggestions** (字符串，80字以上):
   - 给出具体的改进建议
   - 指导学生如何完善答案
   - 提供学习方向

5. **standardAnswer** (字符串，200字以上):
   - 提供一个完整、准确、专业的参考答案
   - 覆盖所有标准答案要点
   - 表述清晰，易于理解`;

    // 4. 调用千帆API
    const apiUrl = 'https://qianfan.baidubce.com/v2/chat/completions';
    const startTime = Date.now();
    const response = await axios.post(apiUrl, {
      model: 'ernie-4.0-8k',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      top_p: 0.8
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 30000
    });
    const responseTime = Date.now() - startTime;
    console.log(`⏱️ API响应时间: ${responseTime}ms`);

    // 5. 解析响应
    const llmResultText = response.data.choices?.[0]?.message?.content;
    console.log('📝 AI返回:', llmResultText?.substring(0, 200));

    let gradeData;
    try {
      gradeData = JSON.parse(llmResultText);
    } catch (parseError) {
      console.log('⚠️ 直接解析失败，尝试提取JSON...');

      // 尝试从```json```代码块中提取
      const jsonMatch = llmResultText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          gradeData = JSON.parse(jsonMatch[1].trim());
          console.log('✅ 从代码块中成功提取JSON');
        } catch (e) {
          console.error('❌ 代码块解析失败');
        }
      }

      // 如果还是失败，尝试找到第一个{和最后一个}
      if (!gradeData) {
        const firstBrace = llmResultText.indexOf('{');
        const lastBrace = llmResultText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            const jsonStr = llmResultText.substring(firstBrace, lastBrace + 1);
            gradeData = JSON.parse(jsonStr);
            console.log('✅ 通过大括号匹配成功提取JSON');
          } catch (e) {
            console.error('❌ 大括号匹配解析失败');
          }
        }
      }

      if (!gradeData) {
        console.error('❌ 所有JSON解析尝试均失败');
        console.error('原始文本:', llmResultText);
        return res.status(500).json({ 
          msg: 'AI返回格式错误，请稍后重试',
          error: 'Failed to parse AI response',
          rawResponse: llmResultText?.substring(0, 500)
        });
      }
    }

    // 6. 验证格式
    const requiredFields = ['score', 'isCorrect', 'analysis', 'suggestions', 'standardAnswer'];
    const missingFields = requiredFields.filter(field => gradeData[field] === undefined || gradeData[field] === null);
    
    if (missingFields.length > 0) {
      return res.status(500).json({ 
        msg: `AI返回格式不完整，缺少字段: ${missingFields.join(', ')}`,
        received: gradeData 
      });
    }

    // 验证字段类型
    if (typeof gradeData.score !== 'number' || 
        typeof gradeData.isCorrect !== 'boolean' ||
        typeof gradeData.analysis !== 'string' ||
        typeof gradeData.suggestions !== 'string' ||
        typeof gradeData.standardAnswer !== 'string') {
      return res.status(500).json({ 
        msg: 'AI返回字段类型错误',
        received: gradeData
      });
    }

    // 确保 score 在 0-100 范围内
    gradeData.score = Math.max(0, Math.min(100, Math.round(gradeData.score)));

    // 确保 isCorrect 与 score 一致
    gradeData.isCorrect = gradeData.score >= 60;

    // 验证内容长度
    if (gradeData.analysis.trim().length < 50) {
      console.warn('⚠️ analysis字段较短:', gradeData.analysis.length, '字符');
    }
    if (gradeData.suggestions.trim().length < 30) {
      console.warn('⚠️ suggestions字段较短:', gradeData.suggestions.length, '字符');
    }
    if (gradeData.standardAnswer.trim().length < 50) {
      console.warn('⚠️ standardAnswer字段较短:', gradeData.standardAnswer.length, '字符');
    }

    console.log(`✅ 评分完成: ${gradeData.isCorrect ? '✅ 及格' : '❌ 不及格'} (得分: ${gradeData.score}/100)`);
    console.log(`📝 分析: ${gradeData.analysis.substring(0, 80)}...`);
    res.json(gradeData);

  } catch (error) {
    console.error('❌ 评分失败:', error.response?.data || error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ msg: 'Grading timeout' });
    }
    
    res.status(500).json({ 
      msg: 'Grading failed',
      error: error.message 
    });
  }
};

// ==================== RAG 问答相关 ====================

/**
 * RAG 问答（非流式）
 * @route POST /api/ai/rag-qa
 * @access Private
 */
/**
 * RAG 问答（非流式）
 * - 从本地向量库召回相关片段并回答
 */
exports.answerWithRAG = async (req, res) => {
  const { question } = req.body;
  
  // 1. 验证输入
  if (!question) {
    return res.status(400).json({ msg: 'Question is required.' });
  }
  
  try {
    console.log(`[RAG] 收到问题: "${question}"`);

    // 检查向量库是否存在
    const fs = require('fs');
    const path = require('path');
    if (!fs.existsSync(path.join(VECTOR_STORE_PATH, 'docstore.json'))) {
      return res.status(503).json({ msg: '知识库正在初始化中，请等待约 2-3 分钟后重试。' });
    }
    
    // 2. 定义 Prompt 模板
    const promptTemplate = PromptTemplate.fromTemplate(
      `你是一个知识库问答机器人。\n` +
      `请根据下面提供的上下文信息来回答用户的问题。如果上下文中没有相关信息，就明确说你不知道，不要编造答案。请让回答简洁明了。\n\n` +
      `上下文：\n{context}\n\n` +
      `问题：{question}\n\n` +
      `回答：`
    );
    
    // 3. 加载向量库并检索（带重试保护和相似度过滤）
    // k=5: 检索 5 个候选文档
    // similarityThreshold=0.5: 只保留相似度 >= 0.5 的文档
    const vectorStore = await HNSWLib.load(VECTOR_STORE_PATH, embeddings);
    const relevantDocs = await retrieveWithRetry(vectorStore, question, 5, 0.5);
    
    // 4. 格式化文档与 Prompt
    const context = relevantDocs.map((doc, i) => `--- 文档 ${i+1} ---\n${doc.pageContent}`).join("\n\n");
    const formattedPrompt = await promptTemplate.format({ context, question });
    
    // 5. 调用 DeepSeek API
    const dsResponse = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: formattedPrompt }],
      temperature: 0.3,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      timeout: 60000
    });

    // 6. 提取回答
    const answer = dsResponse.data.choices?.[0]?.message?.content || '抱歉，未获取到回答。';
    
    console.log(`[RAG] 回答生成成功，检索到 ${relevantDocs.length} 个源文档。`);
    
    // 10. 返回结果
    res.json({ 
      answer,
      sources: relevantDocs.map(doc => ({
        content: doc.pageContent,
        metadata: doc.metadata
      }))
    });
    
  } catch (error) {
    console.error('[RAG] RAG Chain 执行错误:', error);
    res.status(500).json({ msg: 'Error answering question with RAG.', error: error.message });
  }
};

/**
 * RAG 问答（流式）
 * @route POST /api/ai/rag-qa-stream
 * @access Private
 */
/**
 * RAG 问答（SSE 流式）
 * - 通过 Server-Sent Events 持续推送模型输出
 */
exports.answerWithRAGStream = async (req, res) => {
  const { question } = req.body;
  
  if (!question) {
    return res.status(400).json({ msg: 'Question is required.' });
  }
  
  // 设置 SSE 头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  try {
    console.log(`[RAG Stream] 收到问题: "${question}"`);
    
    // 检查向量库是否存在
    const fs = require('fs');
    const path = require('path');
    if (!fs.existsSync(path.join(VECTOR_STORE_PATH, 'docstore.json'))) {
      res.write(`data: ${JSON.stringify({ chunk: '⚙️ 知识库正在初始化中，请等待约 2-3 分钟后刷新重试。\n\n（首次部署需要将您的知识点建立索引，这是一次性操作。）' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    // 定义 Prompt 模板
    const promptTemplate = PromptTemplate.fromTemplate(
      `你是一个知识库问答机器人。\n` +
      `请根据下面提供的上下文信息来回答用户的问题。如果上下文中没有相关信息，就明确说你不知道，不要编造答案。请让回答简洁明了。\n\n` +
      `上下文：\n{context}\n\n` +
      `问题：{question}\n\n` +
      `回答：`
    );

    // 加载向量库并检索（带重试保护和相似度过滤）
    const vectorStore = await HNSWLib.load(VECTOR_STORE_PATH, embeddings);
    console.log('[RAG Stream] 开始检索文档...');
    const relevantDocs = await retrieveWithRetry(vectorStore, question, 5, 0.5);
    console.log(`[RAG Stream] 检索到 ${relevantDocs.length} 个相关文档`);

    // 格式化文档与 Prompt
    const context = relevantDocs.map((doc, i) => `--- 文档 ${i+1} ---\n${doc.pageContent}`).join("\n\n");
    const formattedPrompt = await promptTemplate.format({ context, question });
    console.log('[RAG Stream] Prompt 构建完成，开始调用 DeepSeek 流式接口...');

    // 调用 DeepSeek 流式 API（OpenAI 兼容格式）
    const dsResponse = await axios.post('https://api.deepseek.com/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: formattedPrompt }],
      temperature: 0.3,
      stream: true,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      responseType: 'stream',
      timeout: 60000
    });

    // 读取 SSE 流并转发给前端
    let chunkCount = 0;
    await new Promise((resolve, reject) => {
      let buffer = '';
      dsResponse.data.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // 保留不完整的最后一行
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
                chunkCount++;
                if (chunkCount === 1) console.log('[RAG Stream] 首个chunk已发送');
              }
            } catch (e) { /* 忽略单行解析错误 */ }
          }
        }
      });
      dsResponse.data.on('end', resolve);
      dsResponse.data.on('error', reject);
    });

    console.log(`[RAG Stream] 共发送 ${chunkCount} 个chunks`);
    
    console.log(`[RAG Stream] 流式输出完毕，发送源文档...`);
    
    // 在末尾发送源文档
    const sources = relevantDocs;
    res.write(`data: ${JSON.stringify({ 
      type: 'sources', 
      sources: sources.map(doc => ({
        content: doc.pageContent,
        metadata: doc.metadata
      }))
    })}\n\n`);
    
    // 结束流
    res.write('data: [DONE]\n\n');
    res.end();
    
    console.log(`[RAG Stream] 流关闭成功。`);
    
  } catch (error) {
    console.error('[RAG Stream] 流式错误:', error);

    // 解析百度 API 具体错误码，提供友好提示
    let userMessage = '⚠️ AI 服务遇到了问题，请稍后再试。';
    try {
      const errData = JSON.parse(error.message);
      if (errData.error_code === 17) {
        userMessage = '⚠️ AI 服务今日调用配额已用尽，请明天再试。\n\n（原因：百度千帆免费模型每日有请求次数上限，明天零点后自动重置。）';
      } else if (errData.error_code === 18) {
        userMessage = '⚠️ AI 服务请求过于频繁（QPS 超限），请稍等几秒后再试。';
      } else if (errData.error_msg) {
        userMessage = `⚠️ AI 服务异常：${errData.error_msg}（错误码 ${errData.error_code}）`;
      }
    } catch (_) { /* error.message 不是 JSON，使用默认消息 */ }

    // 以 chunk 形式发送，用户可在对话气泡中直接看到原因
    res.write(`data: ${JSON.stringify({ chunk: userMessage })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
};
