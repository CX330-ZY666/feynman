好的，这是为您的《大前端与AI实战》实训课程设计的第十次课程的详细内容。这次课程将引入RAG技术，是整个项目中技术深度最足、最接近当前AI应用前沿的一节课。考虑到其复杂性，本次课将专注于后端的基础设施建设。

---

### **《大前端与AI实战》第十次课程：RAG与私有知识库 (Part 1 - 后端基础)**

**课程主题：** 让AI学习你的专属知识：RAG后端实现之文档处理与向量化
**总时长：** 4学时 (约3-3.5小时教学，半小时答疑与休息)

#### **一、 本次课程目标 (Objectives)**

在本次课程结束后，每位同学都应该能够：
1.  **清晰地阐述** RAG (Retrieval-Augmented Generation，检索增强生成) 的核心思想和工作流程。
2.  **理解** 文本嵌入 (Text Embedding) 和向量数据库的基本概念。
3.  **使用 `LangChain.js`** (或原生代码) 实现文本的加载 (Load) 和分割 (Split)。
4.  **在Node.js后端** 调用百度千帆的 Embedding API，将文本块转换为向量。
5.  **使用一个简单的本地向量数据库** (如 `HNSWLib` from LangChain.js 或内存中的 `FAISS` 绑定) 来存储文本块及其对应的向量。
6.  **实现一个API**，该API能够在用户创建或更新知识点时，自动将其内容处理并存入向量数据库，为后续的检索做好准备。

#### **二、 核心关键词 (Keywords)**

*   RAG (Retrieval-Augmented Generation)
*   文本嵌入 (Text Embedding) / 向量化
*   向量数据库 (Vector Database)
*   `LangChain.js`
*   文本加载器 (Document Loaders)
*   文本分割器 (Text Splitters)
*   `HNSWLib` / `FAISS` (向量存储与检索)
*   百度千帆 Embedding API

---

### **三、 详细教学流程 (Step-by-Step Guide)**

---

#### **第一部分：理论突破 - RAG与向量的世界 (约60分钟)**

**教师讲解，辅以图示：**

1.  **回顾与问题引入**
    *   “到目前为止，我们所有的AI功能，无论是评价还是出题，都是基于**单个**知识点的上下文。如果我们问AI一个问题：‘请比较一下React的类组件和函数式组件的生命周期’，而这两个知识点是分开存储的，AI就无法回答，因为它在单次请求中看不到全部信息。”
    *   “更进一步，如果我想上传一篇20页的PDF论文，然后问AI‘这篇论文的核心贡献是什么？’，我能把20页的内容全都塞进Prompt里吗？不行！大多数大模型有上下文长度限制（Token Limit）。”
    *   **引出RAG：** “RAG就是解决这个问题的钥匙。它的核心思想是：**不要把整个图书馆（知识库）都塞给AI，而是在AI回答问题前，先帮它快速地从图书馆里找到最相关的几页书（文本片段），然后把这几页书和问题一起交给AI去阅读和回答。**”

2.  **RAG工作流程详解（三步走）**
    *   **（用流程图讲解）**
    *   **Step 1: 索引 (Indexing) - 建立图书馆（本次课的重点）**
        1.  **加载 (Load):** 把你的文档（TXT, PDF, Markdown...）加载进来。
        2.  **分割 (Split):** 把长文档切成一个个更小的、有意义的文本块（Chunks）。比如按段落、按句子切。
        3.  **嵌入 (Embed):** 把每个文本块都通过一个 Embedding 模型，转换成一个由数字组成的“向量（Vector）”。
            *   **类比：** “这个向量就像是这个文本块在‘语义空间’中的坐标。意思相近的文本块，它们的坐标也相近。”
        4.  **存储 (Store):** 把文本块和它对应的向量一起，存入一个特殊的“向量数据库”里。
    *   **Step 2: 检索 (Retrieval) - 找书**
        1.  当用户提问时，也把**用户的问题**通过同一个 Embedding 模型，转换成一个向量。
        2.  拿着这个“问题向量”，去向量数据库里进行“相似度搜索”，找到与它“坐标”最接近的几个文本块向量。
        3.  把这几个最相关的文本块原文取出来。
    *   **Step 3: 生成 (Generation) - 阅读并回答**
        1.  创建一个新的、增强的 Prompt，它包含：
            *   原始的用户问题。
            *   从数据库里检索出来的相关文本块。
        2.  把这个增强的 Prompt 发送给大语言模型（如文心一言）。
        3.  LLM 根据你提供的上下文（检索到的文本块）来精准地回答用户的问题。

3.  **技术选型介绍**
    *   **`LangChain.js`:** “这是一个能极大简化RAG流程的开源框架。它把加载、分割、嵌入、存储、检索这些步骤都封装成了标准化的组件，让我们能像搭积木一样快速构建RAG应用。今天我们将重点使用它。”
    *   **Baidu Qianfan Embeddings:** 百度提供的文本向量化模型API。
    *   **`HNSWLib`:** 一个高性能的、完全在本地运行的向量存储库。它以文件的形式保存在服务器上，非常适合教学和小型项目，无需安装独立的数据库服务。

---

#### **第二部分：后端RAG基础设施搭建 (约120分钟)**

**教师带领学生后端编码：**

1.  **安装新依赖**
    *   在后端项目 (`feynman-platform-backend`) 终端中安装：
        ```bash
        npm install langchain @langchain/community @langchain/baidu-qianfan hnswlib-node
        ```
        *   `langchain`: LangChain.js 核心包。
        *   `@langchain/community`: 包含社区贡献的各种集成，如文档加载器。
        *   `@langchain/baidu-qianfan`: 专门用于集成百度千帆的包。
        *   `hnswlib-node`: `HNSWLib`的Node.js绑定。

2.  **创建AI服务模块**
    *   在后端根目录新建 `services` 文件夹。
    *   在 `services` 中新建 `vectorStoreService.js`，这里将存放我们所有与向量存储相关的逻辑。

    ```javascript
    // services/vectorStoreService.js
    const { HNSWLib } = require("@langchain/community/vectorstores/hnswlib");
    const { BaiduQianfanEmbeddings } = require("@langchain/baidu-qianfan");
    const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
    const path = require('path');

    const VECTOR_STORE_PATH = path.join(__dirname, '../vector_store');

    // 初始化百度千帆的Embedding模型
    const embeddings = new BaiduQianfanEmbeddings({
        baiduApiKey: process.env.QIANFAN_API_KEY, // LangChain的SDK会自动读取环境变量
        baiduApiSecret: process.env.QIANFAN_SECRET_KEY,
        // modelName: "Embedding-V1" // 可以指定模型，默认为Embedding-V1
    });

    // 文本分割器
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,  // 每个文本块的最大长度
        chunkOverlap: 50, // 块之间的重叠长度，保证语义连续性
    });

    /**
     * 将单个知识点的内容添加到向量数据库中
     * @param {object} knowledgePoint - 包含 _id 和 content 的知识点对象
     */
    exports.addKnowledgePointToStore = async (knowledgePoint) => {
        try {
            console.log(`正在为知识点 ${knowledgePoint._id} 创建向量...`);

            // 1. 分割文本
            const docs = await textSplitter.createDocuments(
                [knowledgePoint.content], // 接收一个字符串数组
                [{ knowledgePointId: knowledgePoint._id.toString() }] // 为每个文档块添加元数据
            );

            console.log(`知识点被分割成 ${docs.length} 个文本块。`);
            
            // 2. 检查向量数据库是否存在，如果存在则加载并添加，否则新建
            let vectorStore;
            try {
                // 尝试加载已存在的存储
                vectorStore = await HNSWLib.load(VECTOR_STORE_PATH, embeddings);
                await vectorStore.addDocuments(docs);
                console.log('向已存在的向量库中添加了新文档。');
            } catch (e) {
                // 如果加载失败（比如文件不存在），则创建一个新的
                console.log('未找到向量库，正在创建新的...');
                vectorStore = await HNSWLib.fromDocuments(docs, embeddings);
            }

            // 3. 保存向量数据库到本地文件
            await vectorStore.save(VECTOR_STORE_PATH);
            console.log(`知识点 ${knowledgePoint._id} 的向量已成功保存。`);

        } catch (error) {
            console.error('添加到向量库失败:', error);
        }
    };
    ```

3.  **集成到现有业务流程中**
    *   **目标：** 当用户创建或更新知识点时，自动调用我们的 `addKnowledgePointToStore` 函数。
    *   **修改知识点路由 (`routes/knowledgePoints.js`):**
        *   首先，引入我们的新服务。
            ```javascript
            // routes/knowledgePoints.js
            const { addKnowledgePointToStore } = require('../services/vectorStoreService');
            ```
        *   **在创建知识点的API (`POST /`) 中调用：**
            ```javascript
            // 在 router.post('/', auth, ...) 的 try 块内
            const kp = await newKp.save();
            
            // 异步调用，无需等待其完成即可返回响应给用户，提升体验
            addKnowledgePointToStore(kp); 
            
            res.json(kp);
            ```
        *   **在更新知识点的API (`PUT /:id`) 中调用：**
            *   **思考：** 更新时，旧的向量怎么办？最简单的方法是先删除旧的，再添加新的。但 `HNSWLib` 的本地文件存储不支持高效的删除。对于本课程，我们可以简化处理：**直接添加新的，允许冗余**。在生产环境中，会选择支持删除的向量数据库（如Pinecone, Weaviate等）。
            ```javascript
            // 在 router.put('/:id', auth, ...) 的 try 块内
            const updatedKp = await KnowledgePoint.findByIdAndUpdate(
                req.params.id,
                { $set: { title, content, status, reviewList } },
                { new: true }
            );

            // 当内容发生变化时，才重新索引
            if (updatedKp.content !== kp.content) { // kp是更新前的对象
                addKnowledgePointToStore(updatedKp);
            }

            res.json(updatedKp);
            ```

---

#### **第三部分：测试与验证 (30分钟)**

**教师引导学生进行测试：**

1.  **清理环境：** 如果之前有 `vector_store` 文件夹，先手动删除它。
2.  **启动后端服务。**
3.  **使用 Postman 操作：**
    *   **创建第一个知识点：**
        *   `POST /api/knowledge-points`
        *   Body中提供 `title` 和 `content` (内容可以长一点，比如一段关于React Hooks的介绍)。
        *   发送请求。
        *   **观察后端控制台日志：** 你应该能看到 “正在创建新的向量库...”, “知识点被分割成 N 个文本块”, “向量已成功保存” 等日志。
        *   **检查文件系统：** 在后端项目根目录下，应该生成了一个 `vector_store` 文件夹，里面包含 `args.json`, `docstore.json`, `hnswlib.index` 等文件。这就是我们本地的向量数据库！
    *   **创建第二个知识点：**
        *   再次发送 `POST` 请求，内容可以是一段关于Vue Composition API的介绍。
        *   **观察后端控制台日志：** 这次应该看到 “向已存在的向量库中添加了新文档”，而不是创建新的。
    *   **更新知识点：**
        *   使用 `PUT /api/knowledge-points/:id` 更新第一个知识点的 `content`。
        *   观察日志，确认 `addKnowledgePointToStore` 被再次调用。

---

#### **四、 课堂总结与作业**

*   **总结：**
    *   “今天我们深入到了现代AI应用的核心技术——RAG。我们不仅理解了它‘检索-增强-生成’的原理，更亲手在后端搭建了RAG的‘地基’。我们学会了如何使用LangChain.js来处理和分割文本，如何调用Embedding模型将知识‘向量化’，并如何将这些信息存储在本地的向量数据库中。现在，我们的应用已经具备了‘学习’和‘记忆’我们提供的任意知识的能力。这个‘图书馆’已经建好，只等下一节课的‘图书管理员’——检索器——来大显身手了！”
*   **课后作业：**
    1.  **必须完成：** 确保创建和更新知识点时，向量数据库能够被正确地创建和追加。尝试创建多个不同主题的知识点，观察 `vector_store` 文件夹的变化。
    2.  **思考与探索（选做）：**
        *   阅读 `LangChain.js` 关于不同 `TextSplitter` 的文档，比如 `CharacterTextSplitter` 和 `MarkdownTextSplitter`，思考它们各自的优劣。
        *   如果我想上传一个TXT文件而不是通过API输入内容，该如何实现？（提示：研究 `LangChain.js` 的 `TextLoader` 或 `DirectoryLoader`，并创建一个新的文件上传API）。
*   **预告下次课内容：**
    *   “‘图书馆’已经建成，藏书日益丰富。下次课，我们将完成RAG的后半部分。我们将创建一个智能问答Agent，当用户提问时，它能快速地从向量数据库中检索出最相关的信息，并结合大模型的能力，给出基于我们自己知识库的、精准的回答。这将是我们项目AI能力的终极体现！”