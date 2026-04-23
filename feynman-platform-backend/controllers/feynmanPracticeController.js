/**
 * controllers/feynmanPracticeController.js
 *
 * 说明：
 * - 费曼练习：模拟“学生”对用户讲解进行追问，帮助暴露认知盲点。
 * - 支持对话上下文、薄弱点记录与状态流转。
 */
const axios = require('axios');
const KnowledgePoint = require('../models/KnowledgePoint');

/**
 * 构建 AI 学生的追问 Prompt
 * @param {string} knowledgePointTitle 标题
 * @param {string} knowledgePointContent 原文（仅供判断准确性，不直接引用）
 * @param {string} userExplanation 用户最新讲解
 * @param {Array<{role:'user'|'ai',content:string}>} conversationHistory 对话历史
 */
function buildStudentQuestionPrompt(knowledgePointTitle, knowledgePointContent, userExplanation, conversationHistory = []) {
  // 构建对话历史文本
  let historyText = '';
  if (conversationHistory.length > 0) {
    historyText = '\n【之前的对话】:\n';
    conversationHistory.forEach(msg => {
      const role = msg.role === 'user' ? '用户' : 'AI学生';
      historyText += `${role}: ${msg.content}\n`;
    });
  }

  // 计算对话轮次（用户讲解的次数）
  const userTurns = conversationHistory.filter(msg => msg.role === 'user').length;

  return `你是一个完全不懂技术的好奇小白学生，名叫"小问"。用户正在用费曼学习法向你解释一个概念。

【知识点标题】: ${knowledgePointTitle}

【知识点原文参考】（仅供你判断用户讲解是否准确，绝对不要直接引用或假设用户讲了什么）:
${knowledgePointContent ? knowledgePointContent.substring(0, 500) : '无'}
${historyText}
【用户最新的讲解】:
${userExplanation}

【当前对话轮次】: 第 ${userTurns + 1} 轮

---

## 核心原则（必须严格遵守）

⚠️ **只能基于用户实际说的内容来提问，不能自己脑补或假设用户讲了什么！**

- 如果用户只是打招呼（如"你好"、"嗨"），你应该友好回应并引导他开始讲解
- 如果用户讲解很简短或不完整，针对他实际说的内容提问
- 如果用户讲解很详细，针对他讲的内容追问细节、举例或边界情况
- **绝对不要**提到用户没说过的概念、术语或内容

## 你的任务

作为一个好奇的小白学生，你需要：

1. **认真"听"用户的解释**，只针对他实际说的内容回应
2. **判断是否需要继续追问**：
   - ✅ 继续追问的条件：用户讲解不完整、有明显遗漏、概念不清晰、缺少例子
   - ❌ 停止追问的条件（满足以下所有条件）：
     * 用户已经讲清楚了核心概念的定义
     * 用户能用自己的话解释原理（不是照搬原文）
     * 用户举了具体例子或应用场景
     * 用户能回答你之前的追问（说明理解深度够）
     * 对话轮次 >= 4 轮
3. **根据用户讲解的完整度调整回应**：
   - 用户只是打招呼 → 友好回应 + 引导开始讲解
   - 用户讲解很简短 → 鼓励继续："嗯嗯，然后呢？能再详细说说吗？"
   - 用户讲解较完整 → 针对性追问（定义、原因、举例、边界、原理）
   - 用户已经讲得很好 → 表扬并结束："太棒了！你讲得很清楚，我完全听懂了！"
4. **问题类型**（仅在用户有实际讲解时使用）：
   - 第1-2轮：追问定义、要求举例
   - 第3-4轮：追问原因、边界情况
   - 第5+轮：深入原理、应用场景
5. **语气要求**：友好、好奇、像一个真正想学习的学生

## 输出格式（严格JSON格式，不要包含markdown代码块标记）

{
  "shouldContinue": true,
  "question": "你作为学生的回复（口语化、自然、50-150字）",
  "reason": "继续追问的原因（如：用户还没举例子）"
}

或者（如果判断用户已经讲清楚了）：

{
  "shouldContinue": false,
  "question": "太棒了！你讲得很清楚，我完全听懂了！你用自己的话解释了核心概念，还举了很好的例子。",
  "reason": "用户已经讲清楚了核心概念、原理和应用场景"
}

**重要**：直接输出JSON对象，不要用\`\`\`json包裹，不要添加任何额外文字。`;
}

/**
 * AI 学生提问接口
 * 路径：POST /api/feynman-practice/ask
 * 功能：基于知识点与用户讲解，返回 1-2 个追问，用于推动“教会别人”的过程。
 */
exports.askQuestion = async (req, res) => {
  const { knowledgePointId, userExplanation, conversationHistory } = req.body;

  if (!knowledgePointId) {
    return res.status(400).json({ msg: '缺少 knowledgePointId' });
  }

  if (!userExplanation || userExplanation.trim().length === 0) {
    return res.status(400).json({ msg: '请输入你的讲解内容' });
  }

  if (userExplanation.length > 3000) {
    return res.status(400).json({ msg: '讲解内容过长，请控制在3000字以内' });
  }

  try {
    // 1. 获取知识点信息
    const kp = await KnowledgePoint.findById(knowledgePointId);
    if (!kp) {
      return res.status(404).json({ msg: '知识点不存在' });
    }

    // 2. 获取API Key（优先使用 DeepSeek）
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekKey) {
      // 开发模式返回mock响应
      console.log('🧪 费曼练习: 使用Mock响应');
      const mockQuestions = [
        `嗯...你说的这个"${kp.title}"，我还是有点不太明白。你能用更简单的话再解释一下吗？最好能举个生活中的例子？`,
        `我好像有点懂了！但是我想问一下，为什么要这样做呢？有什么好处吗？`,
        `等等，你说的这个概念，如果换一种情况会怎么样？比如说...`,
        `哦~原来是这样！那你能告诉我，在实际中这个是怎么用的吗？`,
        `我有个问题，你提到的这个和其他类似的东西有什么区别呢？`
      ];
      const randomQuestion = mockQuestions[Math.floor(Math.random() * mockQuestions.length)];
      return res.json({
        question: randomQuestion,
        source: 'mock'
      });
    }

    // 3. 构建Prompt
    const prompt = buildStudentQuestionPrompt(
      kp.title,
      kp.content,
      userExplanation,
      conversationHistory || []
    );

    // 4. 调用 DeepSeek API
    console.log('🎓 费曼练习: 调用AI学生 (DeepSeek)...');
    const apiUrl = 'https://api.deepseek.com/chat/completions';

    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 300
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekKey}`
      },
      timeout: 20000
    });

    // 5. 解析响应
    const aiResponseText = response.data.choices?.[0]?.message?.content;

    if (!aiResponseText) {
      throw new Error('AI返回内容为空');
    }

    console.log('📝 AI原始返回:', aiResponseText.substring(0, 200));

    // 尝试解析JSON格式
    let aiResponse;
    try {
      // 尝试直接解析
      aiResponse = JSON.parse(aiResponseText);
    } catch (parseError) {
      console.log('⚠️ 直接解析失败，尝试提取JSON...');

      // 尝试从```json```代码块中提取
      const jsonMatch = aiResponseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          aiResponse = JSON.parse(jsonMatch[1].trim());
          console.log('✅ 从代码块中成功提取JSON');
        } catch (e) {
          console.error('❌ 代码块解析失败');
        }
      }

      // 如果还是失败，尝试找到第一个{和最后一个}
      if (!aiResponse) {
        const firstBrace = aiResponseText.indexOf('{');
        const lastBrace = aiResponseText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            const jsonStr = aiResponseText.substring(firstBrace, lastBrace + 1);
            aiResponse = JSON.parse(jsonStr);
            console.log('✅ 通过大括号匹配成功提取JSON');
          } catch (e) {
            console.error('❌ 大括号匹配解析失败');
          }
        }
      }

      // 如果所有尝试都失败，降级为纯文本模式
      if (!aiResponse) {
        console.warn('⚠️ JSON解析失败，降级为纯文本模式');
        aiResponse = {
          shouldContinue: true,
          question: aiResponseText.trim(),
          reason: '无法解析JSON，使用原始文本'
        };
      }
    }

    // 验证响应格式
    if (typeof aiResponse.shouldContinue !== 'boolean' || !aiResponse.question) {
      console.warn('⚠️ 响应格式不完整，使用默认值');
      aiResponse = {
        shouldContinue: true,
        question: aiResponse.question || aiResponseText.trim(),
        reason: aiResponse.reason || '格式不完整'
      };
    }

    console.log(`✅ AI学生提问成功 (继续追问: ${aiResponse.shouldContinue})`);
    res.json({
      question: aiResponse.question.trim(),
      shouldContinue: aiResponse.shouldContinue,
      reason: aiResponse.reason || '',
      source: 'deepseek'
    });

  } catch (error) {
    console.error('❌ 费曼练习AI调用失败:', error.response?.data || error.message);

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ msg: 'AI响应超时，请重试' });
    }

    res.status(500).json({
      msg: 'AI学生暂时无法回应，请稍后重试',
      error: error.message
    });
  }
};

/**
 * 评估用户理解度
 * 路径：POST /api/feynman-practice/evaluate-understanding
 * 功能：判断用户是真理解还是只是复述，给出理解度评分
 */
exports.evaluateUnderstanding = async (req, res) => {
  const { knowledgePointId, conversationHistory } = req.body;

  if (!knowledgePointId || !conversationHistory || conversationHistory.length === 0) {
    return res.status(400).json({ msg: '缺少必要参数' });
  }

  try {
    // 1. 获取知识点信息
    const kp = await KnowledgePoint.findById(knowledgePointId);
    if (!kp) {
      return res.status(404).json({ msg: '知识点不存在' });
    }

    // 2. 提取所有用户讲解
    const userExplanations = conversationHistory
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join('\n\n');

    if (!userExplanations.trim()) {
      return res.status(400).json({ msg: '没有用户讲解内容' });
    }

    // 3. 获取API Key
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekKey) {
      // Mock模式
      return res.json({
        understandingScore: 75,
        isParroting: false,
        strengths: ['能用自己的话表达', '举了例子'],
        weaknesses: ['可以更深入解释原理'],
        feedback: '你对这个概念有一定理解，能用自己的话表达核心思想。建议继续深入学习背后的原理。'
      });
    }

    // 4. 构建评估Prompt
    const prompt = `你是一个专业的学习评估专家。请评估学生对知识点的理解程度。

【知识点标题】: ${kp.title}

【知识点原文】:
${kp.content ? kp.content.substring(0, 1000) : '无'}

【学生的完整讲解】:
${userExplanations}

---

## 评估任务

请从以下维度评估学生的理解程度：

1. **理解深度** (0-100分)：
   - 90-100分：深刻理解原理，能举一反三，有自己的见解
   - 70-89分：理解核心概念，能用自己的话表达，有例子
   - 50-69分：基本理解，但表达不够清晰或有遗漏
   - 30-49分：部分理解，有明显错误或混淆
   - 0-29分：基本不理解，只是机械复述

2. **是否只是复述** (true/false)：
   - 判断标准：
     * 用词和原文高度相似（80%以上相同） → 可能是复述
     * 有自己的例子、类比、应用场景 → 不是复述
     * 能回答"为什么"、"怎么用"等深度问题 → 不是复述

3. **优点** (数组)：列出学生讲解中的亮点（2-4个）

4. **待改进** (数组)：列出需要加强的地方（2-4个）

5. **反馈** (字符串)：给学生的综合评价和建议（100-200字）

## 输出格式（严格JSON，不要markdown包裹）

{
  "understandingScore": 85,
  "isParroting": false,
  "strengths": ["能用自己的话表达核心概念", "举了JWT在登录场景的例子", "理解了签名的作用"],
  "weaknesses": ["对三部分的具体结构还不够清楚", "可以补充安全性方面的知识"],
  "feedback": "你对JWT有很好的理解！能用自己的话解释核心概念，还举了实际应用的例子。建议进一步学习JWT的三部分结构（Header、Payload、Signature）的具体内容，以及为什么签名能保证安全性。"
}`;

    // 5. 调用DeepSeek API
    console.log('🎯 评估用户理解度...');
    const apiUrl = 'https://api.deepseek.com/chat/completions';

    const response = await axios.post(apiUrl, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekKey}`
      },
      timeout: 20000
    });

    // 6. 解析响应
    const aiResponseText = response.data.choices?.[0]?.message?.content;
    if (!aiResponseText) {
      throw new Error('AI返回内容为空');
    }

    let evaluation;
    try {
      evaluation = JSON.parse(aiResponseText);
    } catch (parseError) {
      // JSON解析容错（同askQuestion的逻辑）
      const jsonMatch = aiResponseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[1].trim());
      } else {
        const firstBrace = aiResponseText.indexOf('{');
        const lastBrace = aiResponseText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
          evaluation = JSON.parse(aiResponseText.substring(firstBrace, lastBrace + 1));
        } else {
          throw new Error('无法解析AI响应');
        }
      }
    }

    // 7. 验证格式
    if (typeof evaluation.understandingScore !== 'number' ||
        typeof evaluation.isParroting !== 'boolean' ||
        !Array.isArray(evaluation.strengths) ||
        !Array.isArray(evaluation.weaknesses) ||
        typeof evaluation.feedback !== 'string') {
      throw new Error('评估结果格式不完整');
    }

    console.log(`✅ 理解度评估完成: ${evaluation.understandingScore}分 (复述: ${evaluation.isParroting})`);
    res.json(evaluation);

  } catch (error) {
    console.error('❌ 理解度评估失败:', error.response?.data || error.message);

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ msg: '评估超时，请重试' });
    }

    res.status(500).json({
      msg: '理解度评估失败',
      error: error.message
    });
  }
};

/**
 * 保存薄弱点（弱项清单）
 * 路径：POST /api/feynman-practice/save-weak-point
 * 用法：将 AI 或自我反思得到的薄弱点持久化到当前知识点。
 */
exports.saveWeakPoint = async (req, res) => {
  const { knowledgePointId, weakPoint } = req.body;

  if (!knowledgePointId || !weakPoint) {
    return res.status(400).json({ msg: '缺少必要参数' });
  }

  try {
    // 将薄弱点保存到知识点的tags中（用特殊前缀标记）
    const kp = await KnowledgePoint.findById(knowledgePointId);
    if (!kp) {
      return res.status(404).json({ msg: '知识点不存在' });
    }

    // 初始化weakPoints数组（如果不存在）
    if (!kp.weakPoints) {
      kp.weakPoints = [];
    }

    // 添加薄弱点
    kp.weakPoints.push({
      content: weakPoint,
      resolved: false,
      createdAt: new Date()
    });

    await kp.save();

    console.log(`📝 已保存薄弱点到知识点 ${knowledgePointId}`);
    res.json({ success: true, weakPoints: kp.weakPoints });

  } catch (error) {
    console.error('❌ 保存薄弱点失败:', error.message);
    res.status(500).json({ msg: '保存失败', error: error.message });
  }
};

/**
 * 切换薄弱点的解决状态（未解决 <-> 已解决）
 * 路径：PUT /api/feynman-practice/resolve-weak-point
 */
exports.resolveWeakPoint = async (req, res) => {
  const { knowledgePointId, weakPointId } = req.body;

  if (!knowledgePointId || !weakPointId) {
    return res.status(400).json({ msg: '缺少必要参数' });
  }

  try {
    const kp = await KnowledgePoint.findById(knowledgePointId);
    if (!kp) {
      return res.status(404).json({ msg: '知识点不存在' });
    }

    const weakPoint = kp.weakPoints.id(weakPointId);
    if (!weakPoint) {
      return res.status(404).json({ msg: '薄弱点不存在' });
    }

    // 切换状态
    weakPoint.resolved = !weakPoint.resolved;
    await kp.save();

    res.json({ success: true, weakPoint });
  } catch (error) {
    console.error('❌ 更新薄弱点状态失败:', error.message);
    res.status(500).json({ msg: '更新失败', error: error.message });
  }
};

/**
 * 获取练习总结（基于本地对话统计）
 * 路径：POST /api/feynman-practice/summary
 */
exports.getSummary = async (req, res) => {
  const { knowledgePointId, conversationHistory } = req.body;

  if (!conversationHistory || conversationHistory.length === 0) {
    return res.json({
      summary: '本次练习没有对话记录',
      questionCount: 0,
      suggestions: []
    });
  }

  const userMessages = conversationHistory.filter(m => m.role === 'user').length;
  const aiMessages = conversationHistory.filter(m => m.role === 'ai').length;

  res.json({
    summary: `本次费曼练习中，你进行了 ${userMessages} 次讲解，AI学生提出了 ${aiMessages} 个问题。`,
    questionCount: aiMessages,
    suggestions: [
      '继续复习不确定的概念',
      '尝试用更多例子来解释',
      '可以画图或类比来加深理解'
    ]
  });
};
