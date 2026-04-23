好的，这是为您的《大前端与AI实战》实训课程设计的第九次课程的详细内容。这次课程将聚焦于AI出题与测评，进一步强化平台的个性化学习和检验功能，形成一个“学-练-评”的完整循环。

---

### **《大前端与AI实战》第九次课程：AI出题与智能测评系统**

**课程主题：** 个性化挑战：AI动态生成题目与自动评分
**总时长：** 4学时 (约3-3.5小时教学，半小时答疑与休息)

#### **一、 本次课程目标 (Objectives)**

在本次课程结束后，每位同学都应该能够：
1.  **深化** Prompt Engineering 技能，能设计出用于生成结构化题目（包含题干、选项、答案、难度）的Prompt。
2.  **实现** 一个后端API，该API能根据指定的知识点内容和难度等级（基础、中等、困难），调用大模型生成相应的题目。
3.  **在前端** 创建一个答题界面，向用户展示AI生成的题目。
4.  **实现** 提交答案的逻辑，将学生的答案和标准答案一同发送给AI进行评判。
5.  **设计** 用于AI评分的Prompt，让AI能够判断学生答案的正确性并给出简短的解释。
6.  **根据测评结果** 更新知识点的掌握状态，如果回答错误，将知识点加入复习列表。

#### **二、 核心关键词 (Keywords)**

*   动态内容生成 (Dynamic Content Generation)
*   结构化输出 (Structured Output)
*   题目类型 (单选、简答)
*   AI 自动评分 (AI Auto-Grading)
*   学习循环 (Learning Loop)
*   State Management (前端状态管理)

---

### **三、 详细教学流程 (Step-by-Step Guide)**

---

#### **第一部分：AI出题的后端实现 (约75分钟)**

**教师讲解与带领后端编码：**

1.  **回顾与承接**
    *   “上节课，我们成功让AI扮演了学习教练的角色，对学生的复述进行评价和打分。今天，我们要让AI更进一步，从‘评委’变身‘出题官’。我们将利用AI，为每个知识点动态生成不同难度的练习题，检验学生的掌握程度。”

2.  **设计出题Prompt**
    *   **讨论：** “我们希望AI给我们什么样的题目？不能只是一段文字，我们需要结构化的数据，方便前端展示。比如，对于选择题，我们需要题干、选项、正确答案。对于简答题，我们需要题干和参考答案。”
    *   **Prompt Engineering 实践 (以生成单选题为例):**
        ```prompt
        你是一个专业的计算机科学出题专家。请根据以下提供的知识点内容和指定的难度，生成一个相关的单项选择题。

        【知识点内容】:
        """
        {{knowledgePointContent}}
        """

        【指定难度】: {{difficulty}}  (可选值为: 基础, 中等, 困难)

        请严格按照以下JSON格式返回题目，不要包含任何额外的解释或文字。
        {
          "type": "single-choice",
          "difficulty": "{{difficulty}}",
          "question": "这里是题干",
          "options": {
            "A": "选项A的内容",
            "B": "选项B的内容",
            "C": "选项C的内容",
            "D": "选项D的内容"
          },
          "answer": "C",
          "explanation": "这里是对正确答案的简短解释"
        }
        ```
        **讲解:** “`{{...}}`是占位符，我们会在代码中动态替换它们。强制JSON输出格式是这次任务成功的关键。”

3.  **创建AI出题的后端API**
    *   在后端的 `controllers/baiduAiController.js` 中添加新函数 `generateQuestion`。
    ```javascript
    // controllers/baiduAiController.js
    // ... (需要 getQianfanAccessToken 函数)

    exports.generateQuestion = async (req, res) => {
        // 从请求体中获取知识点内容和难度
        const { knowledgePointContent, difficulty } = req.body;

        if (!knowledgePointContent || !difficulty) {
            return res.status(400).json({ msg: 'Knowledge point content and difficulty are required.' });
        }

        try {
            const accessToken = await getQianfanAccessToken();
            const url = `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/eb-instant?access_token=${accessToken}`;

            const prompt = `
            你是一个专业的计算机科学出题专家。请根据以下提供的知识点内容和指定的难度，生成一个相关的单项选择题。

            【知识点内容】:
            """
            ${knowledgePointContent}
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
            }
            `;
            
            const response = await axios.post(url, { messages: [{ role: 'user', content: prompt }] });
            
            // 增加健壮性：尝试解析JSON，如果失败则请求重试或返回错误
            try {
                const questionData = JSON.parse(response.data.result);
                res.json(questionData);
            } catch (parseError) {
                console.error("LLM did not return valid JSON:", response.data.result);
                res.status(500).json({ msg: "AI返回格式错误，请稍后重试" });
            }

        } catch (error) {
            console.error('Error calling LLM API for question generation:', error.response ? error.response.data : error.message);
            res.status(500).send('Server error during question generation.');
        }
    };
    ```

4.  **添加路由**
    *   在 `routes/ai.js` (或你选择的路由文件) 中添加新路由。
        ```javascript
        // routes/ai.js
        // ...
        const { generateQuestion } = require('../controllers/baiduAiController');

        router.post('/generate-question', auth, generateQuestion);
        // ...
        ```
    *   **使用Postman测试：** 发送一个 `POST` 请求到 `/api/ai/generate-question`，Body中包含 `knowledgePointContent` 和 `difficulty`，检查返回结果是否是符合我们预期的JSON格式。

---

#### **第二部分：前端答题界面的实现 (约90分钟)**

**教师带领学生前端编码：**

“后端出题官已经就位，现在我们来搭建考场——前端答题界面。”

1.  **创建答题页面组件**
    *   在 `src/pages` 下新建 `QuizPage.jsx`。
    *   **状态设计：** 我们需要状态来管理：
        *   当前题目 (`question`)
        *   加载状态 (`isLoading`)
        *   用户的选择 (`selectedOption`)
        *   测评结果 (`result`)
        *   知识点本身 (`knowledgePoint`)
    *   **编写 `QuizPage.jsx` 骨架：**
        ```jsx
        // src/pages/QuizPage.jsx
        import { useState, useEffect } from 'react';
        import { useParams, useNavigate } from 'react-router-dom';
        import apiClient from '../api/axios';

        function QuizPage() {
            const { id } = useParams(); // 知识点ID
            const navigate = useNavigate();

            const [knowledgePoint, setKnowledgePoint] = useState(null);
            const [question, setQuestion] = useState(null);
            const [selectedOption, setSelectedOption] = useState('');
            const [result, setResult] = useState(null); // { isCorrect: boolean, explanation: string }
            const [isLoading, setIsLoading] = useState(true);

            // 1. 加载知识点内容
            useEffect(() => {
                const fetchKp = async () => {
                    try {
                        const response = await apiClient.get(`/knowledge-points/${id}`);
                        setKnowledgePoint(response.data);
                    } catch (error) {
                        console.error(error);
                    }
                };
                fetchKp();
            }, [id]);

            // 2. 获取题目 (在知识点加载后)
            const fetchQuestion = async (difficulty) => {
                if (!knowledgePoint) return;
                setIsLoading(true);
                setQuestion(null);
                setResult(null);
                setSelectedOption('');
                try {
                    const response = await apiClient.post('/ai/generate-question', {
                        knowledgePointContent: knowledgePoint.content,
                        difficulty: difficulty,
                    });
                    setQuestion(response.data);
                } catch (error) {
                    console.error(error);
                } finally {
                    setIsLoading(false);
                }
            };
            
            // 3. 提交答案
            const handleSubmit = (e) => {
                e.preventDefault();
                if (!selectedOption) {
                    alert('请选择一个答案！');
                    return;
                }
                
                const isCorrect = selectedOption === question.answer;
                setResult({
                    isCorrect: isCorrect,
                    explanation: question.explanation
                });

                // 如果回答错误，自动将知识点加入复习列表
                if (!isCorrect) {
                    updateReviewStatus(true);
                }
            };

            const updateReviewStatus = async (needsReview) => {
                try {
                    await apiClient.put(`/knowledge-points/${id}`, { reviewList: needsReview });
                } catch (error) {
                    console.error("更新复习状态失败", error);
                }
            };

            if (!knowledgePoint) return <p>加载知识点信息...</p>;

            return (
                <div>
                    <h1>知识点测评: {knowledgePoint.title}</h1>
                    <div>
                        <p>选择难度:</p>
                        <button onClick={() => fetchQuestion('基础')}>基础</button>
                        <button onClick={() => fetchQuestion('中等')}>中等</button>
                        <button onClick={() => fetchQuestion('困难')}>困难</button>
                    </div>
                    <hr />

                    {isLoading && <p>AI正在出题中...</p>}

                    {question && !result && (
                        <form onSubmit={handleSubmit}>
                            <h3>{question.question}</h3>
                            <div>
                                {Object.entries(question.options).map(([key, value]) => (
                                    <div key={key}>
                                        <input
                                            type="radio"
                                            id={key}
                                            name="option"
                                            value={key}
                                            checked={selectedOption === key}
                                            onChange={(e) => setSelectedOption(e.target.value)}
                                        />
                                        <label htmlFor={key}>{value}</label>
                                    </div>
                                ))}
                            </div>
                            <button type="submit">提交答案</button>
                        </form>
                    )}

                    {result && (
                        <div>
                            <h2>测评结果</h2>
                            <p style={{ color: result.isCorrect ? 'green' : 'red', fontWeight: 'bold' }}>
                                {result.isCorrect ? '回答正确！' : '回答错误！'}
                            </p>
                            <p><strong>正确答案是: {question.answer}</strong></p>
                            <p><strong>解释:</strong> {result.explanation}</p>
                            {!result.isCorrect && <p style={{color: 'orange'}}>该知识点已加入你的复习列表。</p>}
                            <button onClick={() => fetchQuestion(question.difficulty)}>再来一题</button>
                            <button onClick={() => navigate('/')}>返回主页</button>
                        </div>
                    )}
                </div>
            );
        }
        export default QuizPage;
        ```
    *   **讲解：**
        *   整个流程是串行的：先加载知识点 -> 用户选择难度 -> 加载题目 -> 用户答题 -> 显示结果。
        *   我们在这里的评分逻辑是前端直接比较答案 (`selectedOption === question.answer`)。这是一个简化的、快速的实现。下一节我们会讨论如何让AI来评分，以支持更复杂的简答题。
        *   回答错误后，调用 `updateReviewStatus` 函数，直接更新后端知识点的 `reviewList` 状态。

2.  **添加路由和入口**
    *   在 `App.jsx` 中添加路由：`<Route path="/quiz/:id" element={<QuizPage />} />`
    *   在 `DashboardPage.jsx` 的知识点列表项中，添加一个“开始测评”的链接或按钮：`<Link to={`/quiz/${kp._id}`}>开始测评</Link>`。

---

#### **第三部分：AI评分与简答题支持 (讨论与进阶) (约45分钟)**

**教师讲解与带领讨论：**

“目前我们的评分机制只能处理选择题，如果我想出一道简答题，让学生用自己的话回答，前端就没法判断对错了。这时，就需要AI再次出马，扮演‘阅卷老师’的角色。”

1.  **设计简答题出题Prompt**
    *   和选择题类似，但输出格式不同：
        ```json
        {
          "type": "short-answer",
          "difficulty": "中等",
          "question": "请简述React中State和Props的区别。",
          "answer_key_points": [
            "Props是从父组件传递给子组件的，是只读的。",
            "State是组件内部自身管理的状态，是可变的。",
            "State的改变会触发组件的重新渲染。"
          ]
        }
        ```
        **讲解:** “我们不要求AI给出‘标准答案’，而是给出‘答案要点’（`answer_key_points`），这为后续AI评分提供了依据。”

2.  **设计AI评分Prompt**
    *   当学生提交了简答题答案后，后端将调用这个Prompt。
        ```prompt
        你是一个客观的计算机科学阅卷老师。请根据以下题目、答案要点和学生的回答，判断学生的回答是否正确，并给出解释。

        【题目】:
        {{question}}

        【答案要点】:
        {{answerKeyPoints}}

        【学生的回答】:
        {{studentAnswer}}

        请严格按照以下JSON格式返回你的评判结果，不要包含任何额外的解释或文字。
        {
          "isCorrect": true,  // 或 false
          "explanation": "这里是你的评判理由，比如：回答基本正确，覆盖了主要区别。或：回答混淆了State和Props的概念。"
        }
        ```

3.  **代码实现思路 (作为挑战任务布置给学生)**
    *   **后端：**
        1.  修改 `generateQuestion` API，增加一个 `type` 参数（'single-choice' 或 'short-answer'），根据类型使用不同的Prompt。
        2.  新建一个 `gradeAnswer` API，接收 `question`, `answerKeyPoints`, `studentAnswer`，调用评分Prompt，返回评分结果。
    *   **前端：**
        1.  在 `QuizPage.jsx` 中，根据后端返回的题目 `type`，渲染不同的输入控件（单选按钮或文本输入框）。
        2.  当提交答案时，如果题目类型是 `short-answer`，则调用新的 `/api/ai/grade-answer` 接口来获取评判结果，而不是在前端直接比较。

---

#### **四、 课堂总结与作业**

*   **总结：**
    *   “今天，我们的‘费曼学习平台’变得更加完整和强大。我们不仅能教、能评，现在还能‘练’了！我们学会了如何利用AI动态生成不同难度的题目，构建了一个完整的‘学-练-评’学习闭环。当学生回答错误时，系统能自动将其纳入复习计划，真正实现了个性化学习。大家现在已经具备了开发复杂智能教育应用的核心能力。”
*   **课后作业：**
    1.  **必须完成：** 确保单选题的“选择难度->AI出题->学生答题->前端评分->更新复习状态”的全流程能够顺畅运行。
    2.  **挑战任务（非常有价值）：** 根据第三部分的讨论，实现对简答题的支持。这需要你修改后端出题API，增加后端评分API，并改造前端答题页面。这是对你综合能力的绝佳锻炼。
*   **预告下次课内容：**
    *   “到目前为止，我们所有的AI交互都是基于单个知识点的。但如果我想问一个横跨多个知识点的问题，或者上传一篇最新的论文让AI学习并回答问题呢？这就超出了普通Prompt的能力范围。下次课，我们将进入AI应用中最前沿、最热门的领域之一——**RAG（检索增强生成）**，学习如何构建一个能与你自己的知识库对话的智能Agent。”