好的，这是为您的《大前端与AI实战》实训课程设计的第三次课程的详细内容。本次课程将完成后端认证闭环，并构建项目核心的CRUD功能，为后续的前端开发和AI集成打下坚实的基础。

---

### **《大前端与AI实战》第三次课程：认证与核心业务API**

**课程主题：** 颁发“通行证”：JWT认证与知识点CRUD实战
**总时长：** 4学时 (约3-3.5小时教学，半小时答疑与休息)

#### **一、 本次课程目标 (Objectives)**

在本次课程结束后，每位同学都应该能够：
1.  **理解** 基于 Token 的认证流程，特别是 JWT (JSON Web Token) 的工作原理。
2.  **完成** 用户登录API，并在登录成功后生成并返回 JWT。
3.  **创建** 一个认证中间件（Middleware），用于保护需要登录才能访问的API路由。
4.  **设计** 知识点（Knowledge Point）的数据模型（Schema）。
5.  **实现** 针对知识点的完整 CRUD (Create, Read, Update, Delete) API。
6.  **熟练使用 Postman** 发送带有认证信息的请求（Bearer Token）。

#### **二、 核心关键词 (Keywords)**

*   认证 (Authentication)
*   JWT (JSON Web Token)
*   中间件 (Middleware)
*   CRUD (Create, Read, Update, Delete)
*   路由模块化 (Router)
*   Bearer Token

---

### **三、 详细教学流程 (Step-by-Step Guide)**

---

#### **第一部分：登录与JWT认证 (约75分钟)**

**教师讲解与带领编码：**

1.  **回顾与挑战任务检查**
    *   “上节课我们实现了用户注册，并留了一个挑战任务——实现用户登录。有同学完成了吗？（邀请同学分享思路或代码，进行点评和引导）”
    *   “今天，我们就来完善这个登录功能，并引入一个至关重要的概念——JWT，给登录成功的用户颁发一个‘数字身份证’。”

2.  **为什么需要 JWT？**
    *   **讲解：** “HTTP协议是无状态的。这意味着服务器不会记住你上一次是谁。你登录了一次，下次再请求别的接口，服务器又不知道你是谁了。”
    *   “JWT就像一张有时效性的电影票。你登录（买票）成功后，服务器给你一张票（JWT）。之后你看电影的任何环节（访问其他需要登录的接口），只需要出示这张票，检票员（服务器）验证票是真的、没过期，就让你通过，而不需要你每次都重新出示身份证买票。”
    *   **JWT结构（简述）：** Header（头部）、Payload（载荷，存放用户信息如用户ID）、Signature（签名，防伪标识）。

3.  **安装 JWT 工具包**
    *   在 VS Code 终端里，输入：
        ```bash
        npm install jsonwebtoken
        ```

4.  **在 `.env` 文件中添加 JWT 密钥**
    *   **讲解：** “为了生成独一无二且无法伪造的签名，我们需要一个‘私钥’，只有我们的服务器知道。”
    *   打开 `.env` 文件，添加一行：
        ```
        JWT_SECRET=this_is_a_very_secret_string_for_feynman_platform
        ```
    *   **强调：** 这个密钥在真实项目中应该是一个更长、更随机的字符串。

5.  **安全加固：安装与讲解密码加密库 `bcryptjs`**
    *   **讲解（重要）：** “在上一节课，我们只是简单地创建了用户，但并没有处理最敏感的数据——密码。**在任何时候，我们都绝对不能将用户的原始密码直接存入数据库！** 这是最严重、最不可原谅的安全漏洞。一旦数据库泄露，所有用户的密码将曝光。”
    *   “我们将使用 `bcryptjs` 这个库来解决问题。它会对用户的密码进行‘哈希处理’，把它变成一串谁也看不懂的乱码。这个过程是单向的，无法从乱码反推出原始密码，但它却可以验证用户输入的密码是否正确。这是现代Web应用保护用户密码的标准做法。”
    *   **安装：**
        ```bash
        npm install bcryptjs
        ```

6.  **完善用户认证API (注册与登录)**
    *   现在，我们将把密码加密集成到我们的注册和登录流程中。
    *   **创建API路由文件：** (如果尚未创建) 为了让 `index.js` 不那么臃肿，我们把用户相关的路由分离出去。
        *   新建文件夹 `routes`。
        *   在 `routes` 文件夹下新建 `users.js` 文件。
    *   **编写完整的 `routes/users.js`:**

        ```javascript
        // routes/users.js
        const express = require('express');
        const router = express.Router();
        const bcrypt = require('bcryptjs'); // 引入加密库
        const jwt = require('jsonwebtoken');
        const User = require('../models/User');

        // --- 用户注册 API (已集成密码加密) ---
        // @route   POST /api/users/register
        // @desc    注册一个新用户
        // @access  Public
        router.post('/register', async (req, res) => {
            try {
                const { name, email, password } = req.body;

                // 1. 检查用户是否已存在
                let user = await User.findOne({ email });
                if (user) {
                    return res.status(400).json({ msg: 'User already exists' });
                }

                // 2. 创建新用户实例
                user = new User({
                    name,
                    email,
                    password
                });

                // 3. 【安全核心】对密码进行哈希加密
                // 讲解：我们使用 bcrypt 库。它会先生成一个“盐”（salt），这是一个随机字符串，
                // 然后将盐和原始密码混合在一起进行哈希计算。
                // 这样做可以确保即使两个用户设置了相同的密码，它们在数据库中的哈希值也完全不同。
                const salt = await bcrypt.genSalt(10); // 10是安全强度，数值越大越安全但越耗时
                user.password = await bcrypt.hash(password, salt); // 生成加密后的密码

                // 4. 保存用户到数据库
                await user.save();

                // 5. 注册成功，直接生成JWT并返回，实现注册后自动登录
                const payload = {
                    user: {
                        id: user.id
                    }
                };

                jwt.sign(
                    payload,
                    process.env.JWT_SECRET,
                    { expiresIn: '5h' },
                    (err, token) => {
                        if (err) throw err;
                        res.json({ token });
                    }
                );

            } catch (err) {
                console.error(err.message);
                res.status(500).send('Server Error');
            }
        });

        // --- 用户登录 API ---
        // @route   POST /api/users/login
        // @desc    用户登录并获取token
        // @access  Public
        router.post('/login', async (req, res) => {
            try {
                const { email, password } = req.body;

                // 1. 检查用户是否存在
                const user = await User.findOne({ email });
                if (!user) {
                    return res.status(400).json({ msg: 'Invalid Credentials' });
                }

                // 2. 【安全核心】比较密码
                // 这里使用 bcrypt.compare 来安全地比较客户端传来的原始密码和数据库中存储的哈希密码。
                // 它会自动处理盐值，我们无需关心。只有密码匹配，才会返回true。
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) {
                    return res.status(400).json({ msg: 'Invalid Credentials' });
                }

                // 3. 登录成功，生成JWT
                const payload = {
                    user: {
                        id: user.id
                    }
                };

                jwt.sign(
                    payload,
                    process.env.JWT_SECRET,
                    { expiresIn: '5h' },
                    (err, token) => {
                        if (err) throw err;
                        res.json({ token });
                    }
                );

            } catch (err) {
                console.error(err.message);
                res.status(500).send('Server Error');
            }
        });

        module.exports = router;
        ```
    *   **在 `index.js` 中使用用户路由:**
        ```javascript
        // index.js

        // ... (数据库连接等代码)

        app.use(express.json());

        // 使用路由文件
        app.use('/api/users', require('./routes/users'));

        // ... (app.listen)
        ```
        **讲解：** "`app.use('/api/users', ...)` 的意思是，所有发往 `/api/users` 前缀的请求，都交给 `users.js` 这个路由文件去处理。所以 `users.js` 里的 `/register` 完整路径就是 `/api/users/register`。"

---

#### **第二部分：保护API - 认证中间件 (约45分钟)**

**教师讲解与带领编码：**

“现在任何人都可以访问我们未来的知识点API，这显然不行。我们需要一个‘保安’——认证中间件，来检查每个请求是否带有合法的‘电影票’（JWT）。”

1.  **中间件概念讲解**
    *   “中间件（Middleware）是 Express 的一个核心概念。它是一个函数，可以在请求到达最终处理函数**之前**执行一些操作。就像流水线上的一个工序，可以检查、修改请求。”
    *   “我们的认证中间件要做的事：检查请求头里有没有 JWT，验证它是否有效，如果有效，就把用户信息附加到请求上，然后放行；如果无效，就直接拒绝。”

2.  **创建认证中间件**
    *   新建文件夹 `middleware`。
    *   在 `middleware` 文件夹下新建 `auth.js` 文件。

    ```javascript
    // middleware/auth.js
    const jwt = require('jsonwebtoken');

    module.exports = function(req, res, next) {
        // 1. 从请求头中获取token
        const token = req.header('x-auth-token');

        // 2. 检查token是否存在
        if (!token) {
            return res.status(401).json({ msg: 'No token, authorization denied' }); // 401: 未授权
        }

        // 3. 验证token
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // 将解码后的用户信息（特别是user.id）附加到请求对象上
            req.user = decoded.user; 
            
            // 调用next()，将控制权交给下一个中间件或路由处理器
            next();

        } catch (err) {
            res.status(401).json({ msg: 'Token is not valid' });
        }
    };
    ```
    **讲解：** “`req.header('x-auth-token')` 是一个约定俗成的标准，前端会把Token放在这个请求头里发送过来。`req.user = decoded.user;` 这一步非常关键，它让后续的路由能直接从 `req.user.id` 中知道当前是哪个用户在操作。”

---

#### **第三部分：核心业务 - 知识点CRUD (约75分钟)**

**教师带领学生一步步敲代码：**

“认证系统完成了，现在开始构建我们平台的核心——知识点管理功能。这部分是典型的后端业务开发，我们会实现增、删、改、查全套API。”

1.  **设计知识点数据模型 (Schema)**
    *   在 `models` 文件夹下新建 `KnowledgePoint.js` 文件。
        ```javascript
        // models/KnowledgePoint.js
        const mongoose = require('mongoose');

        const KnowledgePointSchema = new mongoose.Schema({
            user: { // 关联到用户
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User' // 引用User模型
            },
            title: {
                type: String,
                required: true
            },
            content: { // 存放Markdown, LaTeX, Mermaid等原始内容
                type: String,
                required: true
            },
            status: { // 学习状态： 'not_started', 'in_progress', 'mastered'
                type: String,
                default: 'not_started'
            },
            reviewList: { // 是否在复习列表中
                type: Boolean,
                default: false
            }
        }, { timestamps: true });

        module.exports = mongoose.model('KnowledgePoint', KnowledgePointSchema);
        ```

2.  **创建知识点路由文件**
    *   在 `routes` 文件夹下新建 `knowledgePoints.js` 文件。

3.  **实现CRUD API**
    *   在 `routes/knowledgePoints.js` 中编写代码。

    ```javascript
    // routes/knowledgePoints.js
    const express = require('express');
    const router = express.Router();
    const auth = require('../middleware/auth'); // 引入认证中间件
    const KnowledgePoint = require('../models/KnowledgePoint');

    // @route   POST /api/knowledge-points
    // @desc    创建一个新的知识点
    // @access  Private (需要登录)
    router.post('/', auth, async (req, res) => { // 在这里使用auth中间件
        try {
            const { title, content } = req.body;
            const newKp = new KnowledgePoint({
                title,
                content,
                user: req.user.id // 从auth中间件附加的req.user中获取用户ID
            });
            const kp = await newKp.save();
            res.json(kp);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    });

    // @route   GET /api/knowledge-points
    // @desc    获取当前用户的所有知识点
    // @access  Private
    router.get('/', auth, async (req, res) => {
        try {
            const kps = await KnowledgePoint.find({ user: req.user.id }).sort({ createdAt: -1 });
            res.json(kps);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    });

    // @route   GET /api/knowledge-points/:id
    // @desc    获取单个知识点详情
    // @access  Private
    router.get('/:id', auth, async (req, res) => {
        // ... (学生可以作为练习，实现获取单个知识点的逻辑)
    });


    // @route   PUT /api/knowledge-points/:id
    // @desc    更新一个知识点
    // @access  Private
    router.put('/:id', auth, async (req, res) => {
        try {
            let kp = await KnowledgePoint.findById(req.params.id);
            if (!kp) return res.status(404).json({ msg: 'Knowledge point not found' });
            // 确保是该用户自己的知识点
            if (kp.user.toString() !== req.user.id) {
                return res.status(401).json({ msg: 'Not authorized' });
            }
            const { title, content, status, reviewList } = req.body;
            kp = await KnowledgePoint.findByIdAndUpdate(
                req.params.id,
                { $set: { title, content, status, reviewList } },
                { new: true } // 返回更新后的文档
            );
            res.json(kp);
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    });

    // @route   DELETE /api/knowledge-points/:id
    // @desc    删除一个知识点
    // @access  Private
    router.delete('/:id', auth, async (req, res) => {
        try {
            let kp = await KnowledgePoint.findById(req.params.id);
            if (!kp) return res.status(404).json({ msg: 'Knowledge point not found' });
            if (kp.user.toString() !== req.user.id) {
                return res.status(401).json({ msg: 'Not authorized' });
            }
            await KnowledgePoint.findByIdAndRemove(req.params.id);
            res.json({ msg: 'Knowledge point removed' });
        } catch (err) {
            console.error(err.message);
            res.status(500).send('Server Error');
        }
    });

    module.exports = router;
    ```
4.  **在 `index.js` 中使用知识点路由**
    ```javascript
    // index.js
    // ...
    app.use('/api/users', require('./routes/users'));
    app.use('/api/knowledge-points', require('./routes/knowledgePoints')); // 新增
    // ...
    ```

---

#### **第四部分：使用 Postman 进行带认证的测试 (15分钟)**

**教师演示，学生模仿：**

“现在我们的知识点API有了‘保安’，我们用 Postman 模拟登录用户，来测试这些新接口。”

1.  **登录并获取 Token：**
    *   在 Postman 中，发送一个 `POST` 请求到 `http://localhost:3000/api/users/login`，Body中提供正确的邮箱和密码。
    *   成功后，你会从响应中得到一个很长的 `token` 字符串。**复制这个 token**。

2.  **测试受保护的路由 (创建知识点):**
    *   新建一个请求。
    *   方法 `POST`，URL `http://localhost:3000/api/knowledge-points`。
    *   **关键步骤：添加认证头**
        *   点击 "Authorization" (或 "Headers") 标签页。
        *   Type 选择 "Bearer Token"。
        *   在右侧的 Token 输入框中，**粘贴你刚才复制的 token**。
    *   点击 "Body" 标签页，选择 "raw" 和 "JSON"，输入内容：
        ```json
        {
            "title": "什么是JWT",
            "content": "# JWT (JSON Web Token)\n是一种开放标准..."
        }
        ```
    *   点击 "Send"。如果一切正常，你会收到 `200 OK` 和新创建的知识点数据。
    *   **尝试不带Token发送请求：** 去掉 "Authorization" 头，再发送一次，你会收到 `401 Unauthorized` 和 `{"msg": "No token, authorization denied"}`。这证明我们的“保安”中间件生效了！
3.  **测试其他CRUD接口：** 鼓励学生自己尝试用 Postman 测试 `GET` (获取所有)、`PUT` (更新)、`DELETE` (删除) 接口。

---

#### **五、 课堂总结与作业 (15分钟)**

*   **总结：**
    *   “今天，我们构建了后端应用的‘龙骨’——完整的认证系统和核心业务的CRUD。我们学会了如何使用JWT保护API，如何用中间件来简化代码，以及如何将业务逻辑模块化。后端的基础设施已经基本完备，下一次课，我们将正式进军前端领域！”
*   **课后作业：**
    1.  **必须完成：** 确保所有用户和知识点的API都能在Postman中成功测试通过。
    2.  **代码完善：** 完成 `GET /api/knowledge-points/:id` 这个获取单个知识点详情的API。逻辑与更新和删除类似，需要先查找，再验证用户权限。
    3.  **预习：** 了解一下 React 的基本概念，比如什么是组件（Component）、JSX语法。
*   **预告下次课内容：**
    *   “后端准备就绪，‘弹药’已经装填好了！下次课，我们将使用强大的前端框架 React 和构建工具 Vite，开始搭建‘费曼学习平台’的用户界面，让我们的应用第一次拥有‘面孔’！”

**答疑环节，课程结束。**