好的，这是为您的《大前端与AI实战》实训课程设计的第十一次课程的详细内容。这次课程将完成RAG的闭环，让学生亲手打造一个能与私有知识库对话的智能Agent。

---

### **《大前端与AI实战》第十一次课程：RAG与私有知识库 (Part 2 - 检索与生成)**

**课程主题：** 打造你的专属AI：实现基于私有知识库的问答Agent
**总时长：** 4学时 (约3-3.5小时教学，半小时答疑与休息)

#### **一、 本次课程目标 (Objectives)**

在本次课程结束后，每位同学都应该能够：
1.  **实现** 向量相似度搜索，从本地向量数据库中根据用户问题检索出最相关的文档片段。
2.  **构建** 一个完整的RAG检索链（Retrieval Chain），将检索、Prompt构建和LLM调用串联起来。
3.  **理解并应用** 大模型上下文协议 (MCP) 的基本原则，优化Prompt结构以提升AI回答的准确性。
4.  **在后端创建** 一个新的API接口，用于接收用户问题并返回基于RAG的回答。
5.  **在前端** 创建一个简单的聊天界面（AI Agent问答界面），用户可以在此界面提问。
6.  **完成前后端联调**，实现一个可以与所有已创建知识点进行对话的完整功能。

#### **二、 核心关键词 (Keywords)**

*   相似度搜索 (Similarity Search)
*   检索器 (Retriever)
*   RAG 链 (RAG Chain)
*   `LangChain Expression Language (LCEL)`
*   大模型上下文协议 (MCP - Model Context Protocol)
*   Prompt 模板 (`PromptTemplate`)
*   聊天界面 (Chat Interface)

---

### **三、 详细教学流程 (Step-by-Step Guide)**

---

#### **第一部分：后端实现RAG检索与生成 (约90分钟)**

**教师讲解与带领后端编码：**

1.  **回顾与承接**
    *   “上节课，我们成功地将知识点内容处理并存入了向量数据库，相当于建好了一个‘语义图书馆’。今天，我们的任务就是训练一位聪明的‘图书管理员’（检索器），并教会一位博学的‘教授’（LLM）如何利用这位管理员找到的资料来回答问题。我们将把RAG的第二步（检索）和第三步（生成）串联起来。”

2.  **实现检索逻辑**
    *   **讲解：** “检索的核心是相似度搜索。当用户提问时，我们把问题也转换成向量，然后在向量数据库中寻找与这个‘问题向量’在语义空间中距离最近的几个‘文档向量’。LangChain.js将这个过程封装成了`Retriever`（检索器）。”
    *   **修改 `services/vectorStoreService.js`，添加检索功能：**
        ```javascript
        // services/vectorStoreService.js
        // ... (保留之前的代码)

        /**
         * 从向量数据库中检索与问题相关的文档
         * @param {string} query - 用户的问题
         * @returns {Promise<Document[]>} - 返回相关文档片段的数组
         */
        exports.queryVectorStore = async (query) => {
            try {
                // 1. 加载向量数据库
                const vectorStore = await HNSWLib.load(VECTOR_STORE_PATH, embeddings);

                // 2. 从向量存储创建一个检索器 (Retriever)
                // .asRetriever(k) 表示返回最相关的 k 个结果
                const retriever = vectorStore.asRetriever(4); 

                // 3. 使用检索器获取相关文档
                const relevantDocs = await retriever.invoke(query);
                
                console.log(`为问题 "${query}" 检索到 ${relevantDocs.length} 个相关文档。`);
                return relevantDocs;

            } catch (error) {
                console.error('从向量库检索失败:', error);
                // 如果向量库不存在，可以返回空数组或特定错误
                if (error.message.includes('No such file or directory')) {
                    return [];
                }
                throw error;
            }
        };
        ```
    *   **教师可以写一个临时测试脚本来演示 `queryVectorStore` 的用法，比如在 `index.js` 里临时调用一下，传入一个问题，看看控制台打印出的检索结果。**

3.  **构建完整的RAG链 (RAG Chain)**
    *   **讲解 LCEL (LangChain Expression Language):** “LCEL是LangChain v0.1版本后引入的核心特性，它允许我们用一种非常优雅、声明式的方式，像管道（pipe）一样把不同的组件（检索器、Prompt、模型等）连接起来。语法是使用`.pipe()`方法。”
    *   **在 `controllers/baiduAiController.js` 中创建RAG问答函数：**
        ```javascript
        // controllers/baiduAiController.js
        const { queryVectorStore } = require('../services/vectorStoreService');
        const { PromptTemplate } = require("@langchain/core/prompts");
        const { StringOutputParser } = require("@langchain/core/output_parsers");
        const { BaiduQianfanChat } = require("@langchain/baidu-qianfan");
        const { RunnableSequence } = require("@langchain/core/runnables");

        // ... (保留之前的代码)

        // 初始化千帆的聊天模型
        const chatModel = new BaiduQianfanChat({
            model: "ERNIE-Bot-turbo",
            baiduApiKey: process.env.QIANFAN_API_KEY,
            baiduApiSecret: process.env.QIANFAN_SECRET_KEY,
        });

        exports.answerWithRAG = async (req, res) => {
            const { question } = req.body;
            if (!question) {
                return res.status(400).json({ msg: 'Question is required.' });
            }

            try {

                // 1. [进阶] 定义遵循大模型上下文协议 (MCP) 的Prompt模板
                // 讲解：MCP是一种向大模型高效、清晰地传递信息的“最佳实践”。
                // 它通过类似XML的标签，明确地告诉模型各部分内容的角色（比如，这是背景资料，这是用户的问题）。
                // 这样做能显著减少歧义，让模型更好地理解任务，从而给出更精确的回答。
                const promptTemplate = PromptTemplate.fromTemplate(
                    `<role>你是一个知识库问答机器人。</role>\n` +
                    `<instruction>请根据下面提供的<context>信息来回答用户的<question>。如果上下文中没有相关信息，就明确说你不知道，不要编造答案。请让回答简洁明了。</instruction>\n\n` +
                    `<context>\n{context}\n</context>\n\n` +
                    `<question>\n{question}\n</question>\n\n` +
                    `<answer>你的回答是：</answer>`
                );
                
                // 2. 加载向量数据库并创建检索器
                const vectorStore = await HNSWLib.load(VECTOR_STORE_PATH, embeddings);
                const retriever = vectorStore.asRetriever(4);

                // 3. 定义一个函数来格式化检索到的文档
                const formatDocs = (docs) => {
                    return docs.map((doc, i) => `--- 文档 ${i+1} ---\n${doc.pageContent}`).join("\n\n");
                };

                // 4. 使用 LCEL 构建 RAG 链
                const ragChain = RunnableSequence.from([
                    // 第1步: 传入问题，并行执行检索和传递原始问题
                    {
                        context: retriever.pipe(formatDocs),
                        question: (input) => input.question,
                    },
                    // 第2步: 将上一步的结果填充到Prompt模板中
                    promptTemplate,
                    // 第3步: 将填充好的Prompt发送给LLM
                    chatModel,
                    // 第4步: 解析LLM的输出，只返回字符串结果
                    new StringOutputParser(),
                ]);

                // 5. 执行链
                const answer = await ragChain.invoke({ question });
                
                res.json({ answer });

            } catch (error) {
                console.error('RAG Chain execution error:', error);
                res.status(500).send('Error answering question with RAG.');
            }
        };
        ```
    *   **讲解:** 详细解释LCEL链的每一步是如何工作的，特别是 `RunnableSequence.from` 和并行执行 `{ context: ..., question: ... }` 的概念。同时强调MCP结构化Prompt的好处。

4.  **添加RAG问答路由**
    *   在 `routes/ai.js` (或你选择的路由文件) 中添加新路由。
        ```javascript
        // routes/ai.js
        // ...
        const { answerWithRAG } = require('../controllers/baiduAiController');

        router.post('/rag-qa', auth, answerWithRAG);
        // ...
        ```
    *   **再次使用Postman测试：** `POST /api/ai/rag-qa`，Body中提供一个与你已创建知识点相关的问题，例如 `{"question": "React Hooks有什么好处？"}`。查看返回的答案是否是基于你之前输入的内容。

---

#### **第二部分：前端实现AI Agent聊天界面 (约105分钟)**

**教师带领学生前端编码：**

“后端的智能大脑已经准备就绪，现在我们来为它打造一个沟通的窗口——聊天界面。”

1.  **创建Agent问答页面组件**
    *   在 `src/pages` 下新建 `AgentPage.jsx`。
    *   **状态设计：**
        *   `messages`: 一个数组，存放整个聊天记录，每个元素是一个对象，如 `{ sender: 'user' | 'bot', text: '...' }`。
        *   `inputValue`: 当前输入框中的内容。
        *   `isLoading`: 是否正在等待机器人回复。
    *   **编写 `AgentPage.jsx` 骨架：**
        ```jsx
        // src/pages/AgentPage.jsx
        import { useState, useRef, useEffect } from 'react';
        import apiClient from '../api/axios';
        import './AgentPage.css'; // 我们将为它添加一些样式

        function AgentPage() {
            const [messages, setMessages] = useState([
                { sender: 'bot', text: '你好！我是你的专属知识库AI助手。有什么可以帮你的吗？' }
            ]);
            const [inputValue, setInputValue] = useState('');
            const [isLoading, setIsLoading] = useState(false);
            const messagesEndRef = useRef(null);

            // 自动滚动到最新消息
            useEffect(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, [messages]);

            const handleSendMessage = async (e) => {
                e.preventDefault();
                if (!inputValue.trim() || isLoading) return;

                const userMessage = { sender: 'user', text: inputValue };
                setMessages(prev => [...prev, userMessage]);
                setInputValue('');
                setIsLoading(true);

                try {
                    const response = await apiClient.post('/ai/rag-qa', { question: inputValue });
                    const botMessage = { sender: 'bot', text: response.data.answer };
                    setMessages(prev => [...prev, botMessage]);
                } catch (error) {
                    console.error('Error fetching AI response:', error);
                    const errorMessage = { sender: 'bot', text: '抱歉，我遇到了一些问题，请稍后再试。' };
                    setMessages(prev => [...prev, errorMessage]);
                } finally {
                    setIsLoading(false);
                }
            };

            return (
                <div className="agent-page">
                    <div className="chat-window">
                        {messages.map((msg, index) => (
                            <div key={index} className={`message ${msg.sender}`}>
                                <div className="message-bubble">{msg.text}</div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="message bot">
                                <div className="message-bubble typing-indicator">
                                    <span></span><span></span><span></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <form className="chat-input-form" onSubmit={handleSendMessage}>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="在这里输入你的问题..."
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading}>
                            {isLoading ? '思考中...' : '发送'}
                        </button>
                    </form>
                </div>
            );
        }

        export default AgentPage;
        ```

2.  **为聊天界面添加CSS样式**
    *   在 `src/pages` 下新建 `AgentPage.css`。
    *   **(提供一段基础的CSS代码给学生，让他们直接复制粘贴，以节约时间专注于逻辑)**
    ```css
    /* src/pages/AgentPage.css */
    .agent-page {
        display: flex;
        flex-direction: column;
        height: 80vh;
        max-width: 800px;
        margin: auto;
        border: 1px solid #ccc;
        border-radius: 8px;
        overflow: hidden;
    }
    .chat-window {
        flex-grow: 1;
        padding: 20px;
        overflow-y: auto;
        background-color: #f9f9f9;
    }
    .message {
        display: flex;
        margin-bottom: 15px;
    }
    .message.user {
        justify-content: flex-end;
    }
    .message.bot {
        justify-content: flex-start;
    }
    .message-bubble {
        max-width: 70%;
        padding: 10px 15px;
        border-radius: 20px;
        line-height: 1.5;
    }
    .message.user .message-bubble {
        background-color: #007bff;
        color: white;
    }
    .message.bot .message-bubble {
        background-color: #e9e9eb;
        color: black;
    }
    .chat-input-form {
        display: flex;
        padding: 10px;
        border-top: 1px solid #ccc;
    }
    .chat-input-form input {
        flex-grow: 1;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 20px;
        margin-right: 10px;
    }
    .chat-input-form button {
        padding: 10px 20px;
        border: none;
        background-color: #007bff;
        color: white;
        border-radius: 20px;
        cursor: pointer;
    }
    .chat-input-form button:disabled {
        background-color: #a0cfff;
    }
    /* 打字中效果 */
    .typing-indicator span {
        height: 8px;
        width: 8px;
        background-color: #9E9EA1;
        border-radius: 50%;
        display: inline-block;
        animation: bob 2s infinite ease-in-out;
    }
    .typing-indicator span:nth-of-type(2) {
        animation-delay: 0.2s;
    }
    .typing-indicator span:nth-of-type(3) {
        animation-delay: 0.4s;
    }
    @keyframes bob {
      0% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
      100% { transform: translateY(0); }
    }
    ```

3.  **添加路由和入口**
    *   在 `App.jsx` 中添加路由：`<Route path="/agent" element={<AgentPage />} />`
    *   在主布局 `Layout.jsx` 的导航栏中，添加一个指向 `/agent` 的链接，如“AI助手”。

---

#### **第三部分：联调与演示 (15分钟)**

1.  **确保所有知识点已索引：** 运行后端，并通过 Postman 或前端界面创建/更新一些知识点，确保 `vector_store` 是最新的。
2.  **启动所有服务：** 后端和前端。
3.  **演示：**
    *   导航到“AI助手”页面。
    *   提出一个与**单个知识点**相关的问题，观察AI是否能准确回答。
    *   提出一个**横跨多个知识点**的综合性问题，观察AI是否能整合信息。
    *   提出一个**知识库中没有**的问题，观察AI是否回答“我不知道”，而不是胡编乱造（这证明RAG和我们优质的Prompt在起作用，有效防止了模型幻觉）。

---

#### **四、 课堂总结与作业**

*   **总结：**
    *   “今天，我们终于为我们亲手打造的‘知识图书馆’配备了智能的‘问答机器人’！我们完成了RAG技术的最后也是最激动人心的部分——检索与生成。通过LangChain Expression Language和MCP结构化Prompt，我们优雅地构建了复杂的AI处理链。现在，我们的应用不再是零散功能的集合，它拥有了一个统一的、可以与整个知识库对话的智能入口。这是我们项目AI能力的巅峰展示！”
*   **课后作业：**
    1.  **必须完成：** 确保AI助手页面可以正常工作，并能根据你输入的知识点进行问答。
    2.  **功能优化（选做）：**
        *   **显示引用来源：** 在AI的回答下方，显示出它是根据哪些文档片段（`relevantDocs`）作出的回答。这需要后端API在返回答案的同时，也返回检索到的`context`，前端再进行展示。这能极大地增加AI回答的可信度。
        *   **流式输出 (Streaming)：** 目前AI的回答是等全部生成完才显示。可以研究如何实现流式输出（像ChatGPT那样一个字一个字地蹦出来）。这需要后端使用流式API，前端使用`Fetch API`或`EventSource`来接收。这是一个非常有挑战但效果拔群的优化。
*   **预告下次课内容：**
    *   “我们的Web应用已经非常强大了。但如何让它在不同的平台上运行？下节课开始，我们将进入课程的最后阶段——高级可视化与跨平台部署。我们将首先学习如何用`Three.js`进行3D数据可视化，为我们的知识图谱赋予三维的生命力！”