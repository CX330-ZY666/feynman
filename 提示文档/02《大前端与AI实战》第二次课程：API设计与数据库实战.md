好的，这是为您的《大前端与AI实战》实训课程设计的第二次课程的详细内容。本次课程承接上一次的 "Hello World" 服务器，正式进入后端核心功能的开发，引入数据库并实现第一个关键业务——用户注册。

---

### **《大前端与AI实战》第二次课程：API设计与数据库实战**

**课程主题：** 从“暂存”到“永存”：用户系统的API设计与数据库集成
**总时长：** 4学时 (约3-3.5小时教学，半小时答疑与休息)

#### **一、 本次课程目标 (Objectives)**

在本次课程结束后，每位同学都应该能够：
1.  **理解** RESTful API 的设计理念和常用 HTTP 动词（GET, POST）。
2.  **了解** NoSQL 数据库 `MongoDB` 的基本概念，并**成功创建**一个免费的云数据库（MongoDB Atlas）。
3.  **使用 `Mongoose`** 在 Node.js 项目中连接到 MongoDB 数据库。
4.  **设计** 用户数据模型（Schema），并**实现**一个完整的、**安全的**用户注册 API 接口。
5.  **掌握 `Postman`** 的基本使用，以测试后端 API 接口。

#### **二、 核心关键词 (Keywords)**

*   RESTful API
*   HTTP 动词 (GET, POST)
*   数据库 (Database)
*   MongoDB / MongoDB Atlas
*   Mongoose (ODM)
*   Schema (数据模型)
*   密码哈希 (Password Hashing)
*   `bcrypt.js`
*   Postman

---

### **三、 详细教学流程 (Step-by-Step Guide)**

---

#### **第一部分：理论先行 - 什么是好的 API？ (约30分钟)**

**教师讲解：**

1.  **回顾上次课内容**
    *   “上节课我们成功搭建了环境，并用 Express 创建了一个能说‘Hello’的服务器。大家的挑战任务完成了吗？（检查/解答学生关于添加新路由的问题）今天，我们要让我们的服务器变得更强大，能真正地处理和存储数据。”

2.  **API 如同餐厅菜单 - RESTful 风格**
    *   **讲解：** “API（应用程序接口）就像是前后端之间的‘合同’或‘菜单’。前端（顾客）通过这份菜单点菜，后端（厨房）根据菜单上的菜品准备并上菜。”
    *   “RESTful 是一种流行的 API 设计风格，它让这个‘菜单’变得非常清晰、规范。”
    *   **核心原则讲解（简化版）：**
        *   **资源 (Resource):** 把你的数据看作是一种资源。比如“用户”、“知识点”都是资源。API 的 URL 应该表示资源，如 `/users`, `/knowledge-points`。
        *   **动词 (Verb):** 使用 HTTP 动词来表示对资源的操作。
            *   `GET`: 获取资源 (查) - “服务员，给我看看所有用户列表。”
            *   `POST`: 创建资源 (增) - “服务员，帮我新注册一个用户。”
            *   `PUT` / `PATCH`: 更新资源 (改) - “服务员，帮我修改一下这个用户的信息。”
            *   `DELETE`: 删除资源 (删) - “服务员，帮我注销这个用户。”
    *   **举例：** “所以，我们要做的‘用户注册’功能，本质上是**创建**一个新的**用户资源**，因此我们应该设计一个 `POST /api/users` 这样的接口。” (加个`/api`前缀是好习惯，用于区分API和其他路由)

---

#### **第二部分：数据仓库 - 拥抱 MongoDB (约60分钟)**

**教师引导，学生动手操作：**

“我们的用户数据现在还不能永久保存，服务器一重启就没了。我们需要一个‘数据仓库’——数据库。我们选择 MongoDB，它灵活、现代，非常适合我们的项目。”

1.  **为什么是 MongoDB？**
    *   **讲解：** “它是一个 NoSQL 数据库，存储的是类似 JSON 的 BSON 文档。它不需要预先定义严格的表格结构，非常灵活，开发速度快，非常适合我们这种快速迭代的项目。”

2.  **创建免费云数据库 (MongoDB Atlas)**
    *   **讲解：** “我们不在自己电脑上安装数据库，而是使用云服务。这样更方便，也更接近真实的企业开发环境。”
    *   **操作指引 (一步步带领学生完成):**
        1.  访问 [MongoDB Atlas 官网](https://www.mongodb.com/cloud/atlas)。
        2.  注册账号并登录。
        3.  创建一个新的项目 (Project)。
        4.  **构建一个数据库 (Build a Database)**，选择免费的 **M0 Free Tier**。
        5.  选择云服务商和区域（保持默认即可），然后创建集群 (Create Cluster)。等待几分钟集群部署。
        6.  **关键步骤 - 设置安全连接：**
            *   **创建数据库用户：** 在左侧 "Database Access" 下，创建一个用户。**务必记下用户名和密码**，比如 `user: feynman-user`, `password: a_strong_password`。
            *   **配置网络访问：** 在左侧 "Network Access" 下，添加一个IP地址。为了方便教学，可以选择 `ALLOW ACCESS FROM ANYWHERE` (0.0.0.0/0)。**并强调：在真实项目中，应该只允许特定IP访问。**
            
            **详细配置步骤：**
            
            1. 登录到您的 MongoDB Atlas账户
            2. 选择您的项目（Cluster0）
            3. 在左侧导航栏中，点击"Network Access"（网络访问）
            4. 点击"Edit"按钮
            5. 在弹出的窗口中，选择"ALLOW ACCESS FROM ANYWHERE"（允许从任何地方访问）选项，这会添加0.0.0.0/0的IP地址
            6. 点击"Confirm"（确认）按钮
            
            完成这些步骤后，您的数据库将允许来自任何IP地址的连接。配置完成后，可以启动服务器并测试MongoDB连接是否成功。
        7.  **获取连接字符串：** 回到 "Database" 视图，点击 "Connect" -> "Drivers"。Node.js 版本选择最新的。复制提供的**连接字符串 (Connection String)**。它看起来像这样：`mongodb+srv://feynman-user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`

---

#### **第三部分：连接世界 - Mongoose 实战 (约75分钟)**

**教师带领学生一步步敲代码：**

“现在，我们有了数据库的地址，接下来就要在我们的代码里建立连接。”

1.  **安装 Mongoose 和 dotenv**
    *   在 VS Code 终端里，输入：
        ```bash
        npm install mongoose dotenv
        ```
    *   **讲解：** "`mongoose` 是连接 MongoDB 的‘桥梁’，它能帮我们更好地组织数据。`dotenv` 是一个能读取 `.env` 配置文件的工具，可以安全地管理我们的敏感信息，比如数据库密码。"

2.  **配置环境变量**
    *   在项目根目录，新建一个文件，命名为 `.env` (注意，前面有个点)。
    *   在 `.env` 文件里写入：
        ```
        MONGO_URI=mongodb+srv://feynman-user:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/feynman-db?retryWrites=true&w=majority
        ```
    *   **重要提示：**
        *   把 `YOUR_PASSWORD` 换成你刚才创建的数据库用户的真实密码。
        *   把 `cluster0.xxxxx.mongodb.net` 换成你自己的连接字符串。
        *   我在末尾添加了数据库名 `feynman-db`，Mongoose 会自动创建它。
    *   在项目根目录，再新建一个 `.gitignore` 文件，并写入一行：
        ```
        .env
        node_modules/
        ```
    *   **讲解：** “`.gitignore` 告诉 Git 哪些文件**不要**上传到代码仓库。我们绝不能把包含密码的 `.env` 文件和庞大的 `node_modules` 文件夹提交上去！”

3.  **在 `index.js` 中建立连接并配置中间件**
    *   修改 `index.js` 文件，引入并使用我们新安装的工具。

    ```javascript
    // index.js

    const express = require('express');
    const mongoose = require('mongoose');
    const cors = require('cors'); // 1. 引入cors
    require('dotenv').config();

    const app = express();
    const port = process.env.PORT || 3000; // 优先使用环境变量中的端口

    // --- 核心中间件 ---
    // 2. 使用cors中间件 - 解决跨域问题
    // 讲解：CORS (Cross-Origin Resource Sharing) 是一个必需的步骤。当我们的前端（比如运行在localhost:5173）
    // 尝试请求后端（运行在localhost:3000）时，浏览器会出于安全策略阻止它。 
    // `cors()` 中间件会自动添加必要的响应头，告诉浏览器“我允许那个地址的请求”，从而让前后端可以顺利通信。
    app.use(cors());

    // 3. 使用express.json()中间件 - 解析请求体
    // 讲解：这个中间件让我们的Express应用能够识别并处理传入的JSON格式数据（比如用户注册时POST的用户名和密码）。
    app.use(express.json());

    // --- 数据库连接 ---
    mongoose.connect(process.env.MONGO_URI)
      .then(() => console.log('MongoDB connected successfully!'))
      .catch(err => console.error('MongoDB connection error:', err));
    
    // ... (后续的API路由)

    app.listen(port, () => {
      console.log(`Feynman Platform backend is running at http://localhost:${port}`);
    });
    ```
    *   **运行与验证：** 保存文件，在终端中**重启服务器** (`Ctrl+C` 停止，然后 `node index.js` 启动)。如果看到 `MongoDB connected successfully!`，恭喜你，代码世界和数据世界已经成功握手！

4.  **实现用户注册功能**
    *   **安装密码加密工具：**
        ```bash
        npm install bcryptjs
        ```
        **讲解：** “**安全第一！我们绝不能明文存储用户密码！**`bcryptjs`会把用户的密码加密成一串谁也看不懂的乱码（哈希值），即使数据库泄露了，用户的密码也是安全的。”
    *   **创建用户模型 (Schema):** 在项目根目录新建一个文件夹 `models`，在其中新建 `User.js` 文件。
        ```javascript
        // models/User.js
        const mongoose = require('mongoose');

        const UserSchema = new mongoose.Schema({
            username: { type: String, required: true, unique: true },
            email: { type: String, required: true, unique: true },
            password: { type: String, required: true },
        }, { timestamps: true }); // timestamps会自动添加createdAt和updatedAt字段

        module.exports = mongoose.model('User', UserSchema);
        ```
    *   **创建API路由 (Route):** 回到 `index.js`，添加注册路由。
        ```javascript
        // 在 index.js 的顶部引入
        const User = require('./models/User');
        const bcrypt = require('bcryptjs');

        // ...

        // 中间件：让Express能解析JSON格式的请求体
        app.use(express.json());

        // --- API 路由 ---
        // POST /api/register - 用户注册
        app.post('/api/register', async (req, res) => {
            try {
                // 1. 从请求体中获取用户名、邮箱、密码
                const { username, email, password } = req.body;

                // 2. 检查用户或邮箱是否已存在
                let user = await User.findOne({ email });
                if (user) {
                    return res.status(400).json({ msg: 'Email already exists' });
                }
                user = await User.findOne({ username });
                if (user) {
                    return res.status(400).json({ msg: 'Username already exists' });
                }

                // 3. 创建新用户实例
                user = new User({ username, email, password });

                // 4. 对密码进行哈希加密
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(password, salt);

                // 5. 将新用户保存到数据库
                await user.save();

                // 6. 返回成功信息 (暂时不返回token)
                res.status(201).json({ msg: 'User registered successfully' });

            } catch (err) {
                console.error(err.message);
                res.status(500).send('Server Error');
            }
        });
        
        // ... (app.listen)
        ```

---

#### **第四部分：测试我们的API - Postman与curl命令 (约20分钟)**

**教师演示，学生模仿：**

“我们的注册接口写好了，但是怎么用呢？现在还没有前端页面，所以我们有两种方式来测试API：专业的API测试工具Postman，或者使用命令行工具curl。”

##### **方法一：使用Postman（图形界面工具）**

1.  下载并安装 [Postman](https://www.postman.com/downloads/)。
2.  打开 Postman，新建一个请求 (New Request)。
3.  **配置请求：**
    *   方法 (Method) 选择 `POST`。
    *   URL 输入 `http://localhost:3000/api/register`。
    *   点击 "Body" 标签页。
    *   选择 "raw"，然后在右侧的下拉菜单中选择 "JSON"。
    *   在文本框中输入要注册的用户信息：
        ```json
        {
            "username": "test_student",
            "email": "student@test.com",
            "password": "a_secure_password123"
        }
        ```
4.  点击 "Send" 按钮发送请求。
5.  **观察结果：**
    *   **成功：** 在下方的响应区 (Response)，你应该会看到 `Status: 201 Created` 和 `{"msg": "User registered successfully"}`。
    *   **失败（重复注册）：** 如果你再点一次 "Send"，应该会看到 `Status: 400 Bad Request` 和 `{"msg": "Email already exists"}`。
    *   **检查数据库：** 回到 MongoDB Atlas 网站，在 "Database" -> "Browse Collections" 中，你会看到一个 `feynman-db` 数据库和 `users` 集合，里面已经有了你刚刚创建的用户数据，并且密码是一长串乱码！

##### **方法二：使用curl命令（命令行工具）**

“如果你不想安装额外的图形界面工具，或者更喜欢使用命令行，curl是一个很好的选择。curl是一个强大的命令行工具，用于发送HTTP请求。”

1.  **打开终端**（在macOS上可以使用Terminal或iTerm）。
2.  **确保服务器正在运行**：
    ```bash
    node index.js
    ```
    **重要提示：** 确保只有一个node进程在运行。如果之前已经启动了服务器，请先使用`Ctrl+C`停止它，然后再重新启动。多个node进程同时运行可能会导致端口冲突或请求处理异常。
3.  **使用curl发送POST请求**：
    ```bash
    curl -X POST http://localhost:3000/api/register \
    -H "Content-Type: application/json" \
    -d '{"username":"test_student","email":"student@test.com","password":"a_secure_password123"}'
    ```
    **命令解释：**
    *   `-X POST`: 指定HTTP方法为POST
    *   `-H "Content-Type: application/json"`: 设置请求头，告诉服务器我们发送的是JSON数据
    *   `-d '{"username":"test_student",...}'`: 设置请求体，包含要注册的用户信息

4.  **观察结果：**
    *   **成功：** 终端会直接显示响应结果：`{"msg":"User registered successfully"}`
    *   **失败（重复注册）：** 如果再次运行相同的命令，会看到：`{"msg":"Email already exists"}`

5.  **使用curl进行更多测试**：
    *   **测试GET请求**（获取所有用户，如果实现了这个接口）：
        ```bash
        curl http://localhost:3000/api/users
        ```
    *   **详细模式**（查看完整的请求和响应信息）：
        ```bash
        curl -v -X POST http://localhost:3000/api/register \
        -H "Content-Type: application/json" \
        -d '{"username":"another_user","email":"another@test.com","password":"password123"}'
        ```
        `-v`参数会显示详细的连接信息、请求头和响应头，对于调试非常有用。

**两种方法的比较：**
*   **Postman**：图形界面友好，适合初学者，可以保存和组织请求，有更丰富的测试功能。
*   **curl**：无需安装额外工具（macOS自带），适合快速测试，可以轻松集成到脚本中，是服务器开发必备技能。

**重要提醒：**
无论使用哪种方法测试API，都**确保只有一个node进程在运行**。如果在测试过程中遇到问题，首先检查是否有多个node进程同时运行，这可能导致请求无法正确处理。可以使用以下命令检查和终止node进程：

```bash
# 查看所有node进程
ps aux | grep node

# 终止指定进程（将PID替换为实际的进程ID）
kill -9 PID
```

---

#### **五、 课堂总结与作业 (15分钟)**

*   **总结：**
    *   “今天我们取得了巨大的进步！我们设计了第一个RESTful API，连接了云数据库，并用工业级的安全标准实现了用户注册功能。大家现在已经是一个初具雏形的后端工程师了！”
*   **课后作业：**
    1.  **必须完成：** 确保用户注册功能在你的本地可以成功运行，并能通过 Postman 创建用户。
    2.  **挑战任务（为下次课做准备）：**
        *   **实现用户登录API：** 创建一个新的路由 `POST /api/login`。
        *   **逻辑提示：**
            1.  接收 `email` 和 `password`。
            2.  根据 `email` 在数据库中查找用户。
            3.  如果用户不存在，返回错误。
            4.  如果用户存在，使用 `bcrypt.compare(password, user.password)` 来比较用户输入的密码和数据库中存储的哈希密码是否匹配。
            5.  如果匹配，返回成功信息；如果不匹配，返回“密码错误”。
*   **预告下次课内容：**
    *   “下次课，我们将在登录成功后，使用 JWT (JSON Web Token) 技术给用户颁发一个‘通行证’，实现真正的用户认证。然后，我们将开始开发项目的核心功能——知识点的增删改查API！”

**答疑环节，课程结束。**

---

#### **六、 进阶技巧与最佳实践 (选学内容)**

##### **1. 错误处理和日志记录的最佳实践**

在实际开发中，良好的错误处理和日志记录对于调试和监控应用程序至关重要。我们可以改进当前的错误处理方式：

```javascript
// 创建一个中间件来处理错误
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 在路由中使用更详细的错误处理
app.post('/api/register', async (req, res) => {
  try {
    // ... 现有代码 ...
  } catch (err) {
    console.error(`用户注册失败: ${err.message}`);
    res.status(500).json({
      success: false,
      message: '用户注册失败',
      error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
  }
});
```

##### **2. API响应格式标准化**

为了使前端更容易处理各种响应，建议使用统一的API响应格式：

```javascript
// 创建一个辅助函数来生成标准响应
const createResponse = (success, data = null, message = '', error = null) => {
  return {
    success,
    data,
    message,
    error
  };
};

// 在路由中使用标准响应格式
app.post('/api/register', async (req, res) => {
  try {
    // ... 现有代码 ...
    
    // 返回成功信息
    res.status(201).json(createResponse(true, null, '用户注册成功'));
    
  } catch (err) {
    // ... 错误处理代码 ...
    
    // 返回错误信息
    res.status(500).json(createResponse(false, null, '用户注册失败', err.message));
  }
});
```

##### **3. 环境变量的更多使用**

除了数据库连接字符串，还可以使用环境变量来管理其他配置：

```javascript
// .env 文件
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret
LOG_LEVEL=info
BCRYPT_ROUNDS=10
```

然后在代码中使用这些环境变量：

```javascript
const port = process.env.PORT || 3000;
const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET;
const logLevel = process.env.LOG_LEVEL || 'info';
const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;

// 使用bcryptRounds替代硬编码的值
const salt = await bcrypt.genSalt(bcryptRounds);
```

##### **4. 代码组织结构优化**

随着项目规模的增长，将代码组织到不同的文件和文件夹中变得非常重要：

```
feynman-platform-backend/
├── src/
│   ├── controllers/     # 控制器 - 处理请求逻辑
│   │   └── userController.js
│   ├── models/          # 数据模型
│   │   └── User.js
│   ├── routes/          # 路由定义
│   │   └── userRoutes.js
│   ├── middleware/      # 中间件
│   │   └── errorHandler.js
│   └── utils/           # 工具函数
│       └── responseHelper.js
├── .env
├── index.js
└── package.json
```

示例：将用户路由分离到单独文件

```javascript
// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// 用户注册路由
router.post('/register', userController.register);

// 用户登录路由
router.post('/login', userController.login);

module.exports = router;
```

```javascript
// src/controllers/userController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { createResponse } = require('../utils/responseHelper');

exports.register = async (req, res) => {
  try {
    // ... 用户注册逻辑 ...
    res.status(201).json(createResponse(true, null, '用户注册成功'));
  } catch (err) {
    // ... 错误处理 ...
    res.status(500).json(createResponse(false, null, '用户注册失败', err.message));
  }
};

exports.login = async (req, res) => {
  // ... 用户登录逻辑 ...
};
```

```javascript
// index.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 路由
app.use('/api/users', require('./src/routes/userRoutes'));

// 数据库连接
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// 错误处理中间件
app.use(require('./src/middleware/errorHandler'));

app.listen(port, () => {
  console.log(`Feynman Platform backend is running at http://localhost:${port}`);
});
```

##### **5. API文档工具介绍**

Swagger/OpenAPI是一个强大的API文档工具，可以帮助你自动生成交互式API文档：

1. 安装必要的包：
```bash
npm install swagger-jsdoc swagger-ui-express
```

2. 创建Swagger配置：
```javascript
// src/utils/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '费曼学习平台 API',
      version: '1.0.0',
      description: '费曼学习平台后端API文档',
    },
    servers: [
      {
        url: 'http://localhost:3000',
      },
    ],
  },
  apis: ['./src/routes/*.js'], // 包含API注解的文件路径
};

const specs = swaggerJsdoc(options);

module.exports = {
  serve: swaggerUi.serve,
  setup: swaggerUi.setup(specs),
};
```

3. 在路由中添加Swagger注解：
```javascript
// src/routes/userRoutes.js
/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: 用户注册
 *     description: 创建一个新用户账户
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: 用户注册成功
 *       400:
 *         description: 用户已存在或请求数据无效
 *       500:
 *         description: 服务器内部错误
 */
router.post('/register', userController.register);
```

4. 在index.js中添加Swagger UI路由：
```javascript
const { serve, setup } = require('./src/utils/swagger');

// ...

// Swagger UI
app.use('/api-docs', serve, setup);

// ...
```

5. 访问 `http://localhost:3000/api-docs` 查看交互式API文档。

##### **6. 单元测试入门**

单元测试是确保代码质量和功能正确性的重要手段。以下是使用Jest进行API测试的简单示例：

1. 安装测试相关包：
```bash
npm install --save-dev jest supertest mongodb-memory-server
```

2. 创建测试配置：
```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

3. 创建测试文件：
```javascript
// tests/user.test.js
const request = require('supertest');
const app = require('../index');
const User = require('../src/models/User');
const mongoose = require('mongoose');

describe('User API', () => {
  beforeAll(async () => {
    // 连接到测试数据库
    await mongoose.connect(process.env.MONGO_TEST_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    // 断开数据库连接
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // 每次测试前清空用户集合
    await User.deleteMany({});
  });

  describe('POST /api/users/register', () => {
    it('应该成功注册一个新用户', async () => {
      const res = await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('用户注册成功');
    });

    it('不应该允许重复的邮箱注册', async () => {
      // 先注册一个用户
      await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'password123'
        });

      // 尝试使用相同的邮箱再次注册
      const res = await request(app)
        .post('/api/users/register')
        .send({
          username: 'testuser2',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });
  });
});
```

4. 运行测试：
```bash
npm test
```

这些进阶技巧和最佳实践可以帮助你构建更加健壮、可维护和可扩展的后端应用程序。随着项目的发展，你会越来越体会到这些实践的价值。