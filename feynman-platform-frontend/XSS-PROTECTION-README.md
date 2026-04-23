# XSS防护实施指南

> **快速开始指南** - 5分钟了解如何验证系统的XSS防护  
> 适用于：开发者、测试人员、安全审计人员

---

## 🎯 概览

本指南帮助您快速验证费曼学习平台的XSS（跨站脚本攻击）防护机制。

**核心防护**：
- ✅ react-markdown (默认安全)
- ✅ rehype-sanitize (清洗危险HTML)
- ✅ 已通过安全测试

---

## 📁 相关文档

本目录包含4个XSS防护相关文档：

| 文档 | 用途 | 适合人群 |
|------|------|---------|
| `XSS-PROTECTION-README.md` | **快速开始** | 所有人 ⭐ |
| `XSS-TEST-PAYLOAD.md` | 测试payload模板 | 测试人员 |
| `XSS-TEST-CHECKLIST.md` | 详细测试清单 | 测试人员 |
| `XSS-SECURITY-GUIDE.md` | 完整安全文档 | 开发者 |

---

## 🚀 快速测试（5分钟）

### 前置条件

确保服务已启动：

```bash
# 启动后端 (终端1)
cd D:\feynman-platform-backend
npm start

# 启动前端 (终端2)
cd D:\feynman-platform-frontend
npm run dev
```

### 测试步骤

#### 步骤1：准备测试payload（30秒）

打开文件：`XSS-TEST-PAYLOAD.md`  
**全选并复制**文件中的所有内容

#### 步骤2：创建测试知识点（1分钟）

1. 访问 http://localhost:5173
2. 点击"+ 新建知识点"
3. 标题输入：`XSS防护测试`
4. 内容**粘贴**刚才复制的payload
5. 点击"创建"

#### 步骤3：验证防护效果（3分钟）

**✅ 成功标志**：
- 页面正常显示
- **无任何alert弹窗出现** ← 最重要！
- 合法内容（代码块、图表）正常渲染

**❌ 失败标志**：
- 出现alert弹窗
- 页面崩溃或报错
- 控制台有XSS相关错误

#### 步骤4：DevTools检查（1分钟）

按F12打开开发者工具：

```
1. Elements标签 → 搜索 "<script"
   预期：0个结果（或仅在代码块中）

2. Console标签
   预期：无错误信息

3. Network标签 → 刷新页面
   预期：无向evil.com等恶意域名的请求
```

---

## 📊 测试结果判定

### ✅ 测试通过

如果满足以下条件，说明XSS防护有效：

```
✓ 无任何alert弹窗
✓ 页面正常显示
✓ DevTools中无<script>标签
✓ DevTools中无onerror、onclick等事件
✓ 代码块、Mermaid图表、数学公式正常工作
```

**结论**：系统安全，可以投入使用 🎉

### ❌ 测试失败

如果出现以下情况，需要修复：

```
✗ 出现alert弹窗
✗ 在DevTools中找到可执行的<script>标签
✗ 在DevTools中找到onerror、onclick等事件处理器
```

**操作**：
1. 立即停止使用
2. 查看[问题排查](#-问题排查)章节
3. 联系开发团队

---

## 🔧 问题排查

### 问题1：XSS攻击未被阻止

**可能原因**：
- rehype-sanitize未正确配置
- 依赖版本不兼容
- 配置被意外修改

**解决方案**：

1. 检查DashboardPage.jsx配置：

```javascript
// 应该包含这行
rehypePlugins={[rehypeSanitize, rehypeKatex]}
```

2. 验证依赖版本：

```bash
cd D:\feynman-platform-frontend
npm list react-markdown rehype-sanitize

# 预期输出
# react-markdown@10.1.0
# rehype-sanitize@6.0.0
```

3. 重新安装依赖：

```bash
npm install react-markdown rehype-sanitize --save
```

### 问题2：合法功能被误伤

**症状**：
- Mermaid图表不显示
- 数学公式不渲染
- 代码块无高亮

**解决方案**：

1. 检查Mermaid初始化：

```javascript
// 在DashboardPage.jsx中应该有
useEffect(() => {
  mermaid.initialize({ startOnLoad: true, theme: 'default' });
  mermaid.contentLoaded();
}, [knowledgePoints]);
```

2. 验证相关依赖：

```bash
npm list mermaid rehype-katex katex
```

3. 清除缓存并重启：

```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

---

## 📖 深入学习

### 对于测试人员

**推荐阅读**：
1. `XSS-TEST-CHECKLIST.md` - 详细测试步骤
2. `XSS-SECURITY-GUIDE.md` - 第3章（测试结果）

**操作建议**：
- 使用检查清单进行完整测试
- 记录测试结果
- 截图保存DevTools验证结果

### 对于开发者

**推荐阅读**：
1. `XSS-SECURITY-GUIDE.md` - 完整文档
   - 第1章：XSS攻击原理
   - 第2章：防护机制说明
   - 第4章：开发最佳实践

**代码示例**：

```javascript
// ✅ 正确：使用react-markdown
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

<ReactMarkdown rehypePlugins={[rehypeSanitize]}>
  {userContent}
</ReactMarkdown>

// ❌ 错误：不要这样做！
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

### 对于安全审计人员

**推荐阅读**：
1. `XSS-SECURITY-GUIDE.md` - 第2章（防护机制）
2. `XSS-TEST-CHECKLIST.md` - 完整测试流程

**审计要点**：
- 验证所有用户内容展示点
- 检查rehype-sanitize配置
- 审查dangerouslySetInnerHTML使用
- 测试OWASP XSS Cheat Sheet中的payload

---

## 🛡️ 安全最佳实践

### Do's（应该做）

```javascript
// 1. 始终使用react-markdown + rehype-sanitize
<ReactMarkdown rehypePlugins={[rehypeSanitize]}>
  {content}
</ReactMarkdown>

// 2. 纯文本直接渲染（React自动转义）
<p>{userText}</p>

// 3. 前后端都进行输入验证
if (!content || content.length > 10000) {
  throw new Error('Invalid input');
}
```

### Don'ts（不应该做）

```javascript
// ❌ 1. 不要直接使用dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: content }} />

// ❌ 2. 不要禁用安全插件
<ReactMarkdown>{content}</ReactMarkdown>  // 缺少rehypeSanitize

// ❌ 3. 不要使用eval或Function
eval(userInput);
```

---

## 📞 获取帮助

### 文档位置

所有XSS防护文档位于前端项目根目录：

```
D:\feynman-platform-frontend\
├── XSS-PROTECTION-README.md     ← 你在这里
├── XSS-TEST-PAYLOAD.md
├── XSS-TEST-CHECKLIST.md
└── XSS-SECURITY-GUIDE.md
```

### 在线资源

- **OWASP XSS指南**：https://owasp.org/www-community/attacks/xss/
- **react-markdown文档**：https://github.com/remarkjs/react-markdown
- **rehype-sanitize文档**：https://github.com/rehypejs/rehype-sanitize

### 联系方式

- **技术问题**：查看`XSS-SECURITY-GUIDE.md`第5章（参考资源）
- **测试支持**：查看`XSS-TEST-CHECKLIST.md`
- **紧急安全问题**：立即联系安全团队

---

## ✅ 下一步

### 首次测试

1. ✅ 阅读本README（你已完成）
2. ⏭️ 打开`XSS-TEST-PAYLOAD.md`
3. ⏭️ 按照[快速测试](#-快速测试5分钟)执行
4. ⏭️ 记录测试结果

### 详细测试

如需完整测试，请按以下顺序：

```
1. 阅读 XSS-PROTECTION-README.md
2. 准备 XSS-TEST-PAYLOAD.md
3. 执行 XSS-TEST-CHECKLIST.md
4. 学习 XSS-SECURITY-GUIDE.md
```

### 开发参考

如果你是开发者，建议：

1. 通读`XSS-SECURITY-GUIDE.md`
2. 重点关注第4章（开发最佳实践）
3. 在代码中应用Do's and Don'ts
4. 编写安全测试用例

---

## 📝 版本历史

| 版本 | 日期 | 变更说明 |
|-----|------|---------|
| 1.0 | 2025-11-10 | 初始版本，包含基础防护验证 |

---

## 📄 许可与声明

本文档遵循项目整体许可协议。

**免责声明**：
- 本文档提供的测试payload仅用于安全测试目的
- 请勿在生产环境以外的场景使用这些攻击代码
- 对XSS攻击代码的滥用造成的任何后果，作者不承担责任

---

**🎉 现在开始测试吧！打开 `XSS-TEST-PAYLOAD.md` 开始你的第一次安全验证。**
