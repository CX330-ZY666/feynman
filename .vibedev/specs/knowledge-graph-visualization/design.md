# 知识图谱可视化功能 - 技术设计文档

## 1. 概览 (Overview)

### 1.1 功能描述
本功能为费曼学习平台添加知识图谱可视化能力，通过 ECharts 力导向图展示用户知识点之间的引用关系网络。用户可以通过交互式图谱直观地理解知识结构，并根据节点颜色快速识别需要复习的内容。

### 1.2 技术栈
- **后端**: Express.js + MongoDB + Mongoose
- **前端**: React 18 + Vite + React Router 7
- **可视化**: ECharts 5.x + echarts-for-react
- **认证**: JWT (现有 auth 中间件)

### 1.3 项目路径
- 后端项目: `D:\feiman\feynman-platform-backend`
- 前端项目: `D:\feiman\feynman-platform-frontend`

---

## 2. 系统架构 (Architecture)

### 2.1 整体架构

```mermaid
graph TB
    A[浏览器客户端] --> B[GraphPage 组件]
    B --> C[ReactECharts]
    B --> D[apiClient]
    D --> E[GET /api/graph/knowledge-map]
    E --> F[Graph Router]
    F --> G[Auth Middleware]
    G --> H[KnowledgePoint Model]
    H --> I[MongoDB Database]
    C --> J[用户交互]
    J --> K[点击节点跳转]
    K --> L[/kp/edit/:id]
```

### 2.2 数据流程

**请求流程**:
1. 用户访问 `/graph` 路由
2. GraphPage 组件挂载，调用 `apiClient.get('/graph/knowledge-map')`
3. 请求携带 JWT Token (Authorization: Bearer \<token\>)
4. 后端 auth 中间件验证身份
5. 查询当前用户的所有知识点
6. 分析内容生成节点和边数据
7. 返回 JSON 格式的图谱数据
8. 前端接收数据并配置 ECharts option
9. ReactECharts 组件渲染力导向图

**交互流程**:
- 鼠标悬停 → ECharts emphasis 配置 → 高亮节点和相邻边
- 点击节点 → onEvents.click → navigate(`/kp/edit/${nodeId}`)
- 拖拽/缩放 → ECharts roam 配置 → 画布操作

---

## 3. 组件与接口 (Components and Interfaces)

### 3.1 后端组件

#### 3.1.1 路由文件: `routes/graph.js`

**职责**: 定义图谱相关的 API 端点

**主要函数**:

```javascript
// GET /api/graph/knowledge-map
// 功能: 生成知识图谱数据
// 认证: 需要 auth 中间件
// 返回: { nodes: [], links: [] }
```

**实现逻辑**:
1. 查询当前用户的所有知识点 (`KnowledgePoint.find({ author: req.user.id })`)
2. 转换为节点数组:
   - 提取字段: id, name, value, symbolSize, reviewList, difficulty, createdAt
   - symbolSize 计算: `20 + Math.min(content.length / 50, 30)`
3. 构建关系映射表: `Map<title, id>`
4. 遍历知识点，检测引用关系:
   - 对于每个知识点 A，遍历所有其他标题
   - 如果 `A.content.includes(B.title)`，创建边 `{ source: A.id, target: B.id }`
   - 避免自引用: `if (A.title === B.title) continue`
5. 返回数据结构

**错误处理**:
- 数据库查询失败: 捕获异常，返回 500 状态码
- 用户无知识点: 返回 `{ nodes: [], links: [] }`

#### 3.1.2 路由注册: `index.js`

在现有路由注册代码后添加:
```javascript
app.use('/api/graph', require('./routes/graph'));
```

位置: 在 `app.use('/api/ai', ...)` 之后，`app.listen()` 之前

---

### 3.2 前端组件

#### 3.2.1 页面组件: `src/pages/GraphPage.jsx`

**职责**: 知识图谱可视化页面

**状态管理**:
```javascript
const [option, setOption] = useState({});      // ECharts 配置对象
const [loading, setLoading] = useState(true);   // 加载状态
```

**生命周期**:
- `useEffect` 挂载时:
  1. 调用 API 获取数据
  2. 处理响应并构建 ECharts option
  3. 设置 option 状态，触发渲染

**ECharts 配置结构**:
```javascript
{
  tooltip: {
    formatter: (params) => {
      // 自定义 HTML 提示框
      // 显示: 标题 + 难度 + 创建时间
    }
  },
  series: [{
    type: 'graph',
    layout: 'force',
    data: nodes.map(node => ({
      ...node,
      itemStyle: {
        color: node.reviewList ? '#FF8C00' : '#5B8FF9'  // 颜色编码
      }
    })),
    links: links,
    roam: true,
    label: {
      show: true,
      position: 'right',
      formatter: '{b}'
    },
    force: {
      repulsion: 100,
      edgeLength: 50
    },
    emphasis: {
      focus: 'adjacency',
      lineStyle: { width: 10 }
    }
  }]
}
```

**事件处理**:
```javascript
const onChartClick = (params) => {
  if (params.componentType === 'series' && params.dataType === 'node') {
    const nodeId = params.data.id;
    navigate(`/kp/edit/${nodeId}`);
  }
};
```

**渲染逻辑**:
- Loading 状态: 显示"正在生成知识图谱..."
- Error 状态: (可选) 显示错误信息
- 成功状态: 渲染 ReactECharts 组件

#### 3.2.2 路由配置: `src/App.jsx`

在 ProtectedRoute 内添加:
```jsx
<Route path="/graph" element={<GraphPage />} />
```

位置: 在 `<Route path="/agent" element={<AgentPage />} />` 之后

#### 3.2.3 导航菜单: `src/components/Layout.jsx`

在导航栏中添加链接:
```jsx
<Link to="/graph" style={{ marginRight: '1rem' }}>知识图谱</Link>
```

位置: 在 "AI助手" 链接之后

---

### 3.3 API 接口规范

#### API: GET /api/graph/knowledge-map

**请求**:
- Method: GET
- Headers: `Authorization: Bearer <JWT_TOKEN>`
- Body: 无

**响应**:

成功 (200):
```json
{
  "nodes": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "React Hooks",
      "value": "React Hooks 是 React 16.8 引入的新特性...",
      "symbolSize": 35,
      "reviewList": false,
      "difficulty": "intermediate",
      "createdAt": "2024-12-01T10:30:00.000Z"
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "name": "useState",
      "value": "useState 是最基础的 Hook...",
      "symbolSize": 28,
      "reviewList": true,
      "difficulty": "beginner",
      "createdAt": "2024-12-02T14:20:00.000Z"
    }
  ],
  "links": [
    {
      "source": "507f1f77bcf86cd799439011",
      "target": "507f1f77bcf86cd799439012"
    }
  ]
}
```

错误响应:
- 401 Unauthorized: Token 无效或过期
- 500 Server Error: 服务器内部错误

---

## 4. 数据模型 (Data Models)

### 4.1 现有模型: KnowledgePoint

```javascript
{
  _id: ObjectId,
  title: String,              // 知识点标题
  content: String,            // 知识点内容
  category: String,           // 分类
  tags: [String],            // 标签
  author: ObjectId,          // 作者 (关联 User)
  difficulty: String,         // 难度: 'beginner' | 'intermediate' | 'advanced'
  isPublic: Boolean,         // 是否公开
  views: Number,             // 浏览次数
  likes: [ObjectId],         // 点赞用户
  reviewList: Boolean,       // 🔑 是否需要复习
  createdAt: Date,           // 🔑 创建时间
  updatedAt: Date            // 更新时间
}
```

**使用字段**:
- `_id`: 节点唯一标识
- `title`: 节点名称 + 关系检测
- `content`: 关系检测来源 + 节点描述
- `author`: 权限控制 (只显示当前用户的数据)
- `reviewList`: 节点颜色编码
- `difficulty`: Tooltip 显示
- `createdAt`: Tooltip 显示

### 4.2 图谱数据结构

#### 节点 (Node)
```typescript
interface GraphNode {
  id: string;           // 知识点 _id 的字符串形式
  name: string;         // 显示名称 (title)
  value: string;        // 描述信息 (content 前 100 字符)
  symbolSize: number;   // 节点大小 (20-50)
  reviewList: boolean;  // 复习状态
  difficulty: string;   // 难度级别
  createdAt: string;    // ISO 格式日期时间
  itemStyle?: {         // ECharts 样式配置
    color: string;      // 节点颜色
  };
}
```

#### 边 (Link)
```typescript
interface GraphLink {
  source: string;  // 源节点 ID
  target: string;  // 目标节点 ID
}
```

#### 完整响应
```typescript
interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
```

---

## 5. 关键算法 (Key Algorithms)

### 5.1 关系发现算法

**目标**: 自动检测知识点之间的引用关系

**算法流程**:
```javascript
// 伪代码
function detectRelationships(knowledgePoints) {
  const titleMap = new Map();  // title -> id 映射
  const links = [];
  
  // 步骤 1: 构建标题映射
  for (const kp of knowledgePoints) {
    titleMap.set(kp.title, kp._id.toString());
  }
  
  // 步骤 2: 检测引用关系
  for (const sourceKp of knowledgePoints) {
    for (const [targetTitle, targetId] of titleMap.entries()) {
      // 避免自引用
      if (sourceKp.title === targetTitle) continue;
      
      // 检测内容中是否包含目标标题
      if (sourceKp.content.includes(targetTitle)) {
        links.push({
          source: sourceKp._id.toString(),
          target: targetId
        });
      }
    }
  }
  
  return links;
}
```

**时间复杂度**: O(n²·m)
- n: 知识点数量
- m: 平均内容长度

**优化空间** (未来):
- 使用正则表达式匹配完整单词边界
- 使用 Trie 树或 Aho-Corasick 算法提升匹配效率
- 缓存关系数据，定期更新

### 5.2 节点大小计算

**公式**: `symbolSize = 20 + min(content.length / 50, 30)`

**逻辑**:
- 基础大小: 20 像素
- 增量: 每 50 个字符增加 1 像素
- 上限: 最大增量 30 像素，总大小不超过 50 像素

**示例**:
- content.length = 100 → symbolSize = 20 + 2 = 22
- content.length = 500 → symbolSize = 20 + 10 = 30
- content.length = 2000 → symbolSize = 20 + 30 = 50 (达到上限)

---

## 6. 错误处理 (Error Handling)

### 6.1 后端错误处理

| 错误类型 | HTTP 状态码 | 响应格式 | 处理策略 |
|---------|------------|---------|---------|
| 认证失败 | 401 | `{ msg: 'No token...' }` | 前端重定向到登录页 |
| 数据库查询失败 | 500 | `{ msg: 'Server Error' }` | 记录日志，返回通用错误 |
| 无知识点数据 | 200 | `{ nodes: [], links: [] }` | 正常返回空数据 |

**实现示例**:
```javascript
router.get('/knowledge-map', auth, async (req, res) => {
  try {
    const kps = await KnowledgePoint.find({ author: req.user.id });
    // ... 处理逻辑
    res.json({ nodes, links });
  } catch (error) {
    console.error('Error generating knowledge graph:', error);
    res.status(500).send('Server Error');
  }
});
```

### 6.2 前端错误处理

| 场景 | 处理方式 | 用户体验 |
|------|---------|---------|
| API 调用失败 | 控制台记录错误，停止加载 | 显示错误提示或保持加载状态 |
| 空数据 | 正常渲染空图表 | 显示友好提示 "暂无知识点数据" |
| 网络超时 | axios 默认处理 | (可选) 添加重试机制 |
| Token 过期 | apiClient 拦截器自动刷新 | 透明处理，用户无感知 |

**实现示例**:
```javascript
useEffect(() => {
  const fetchData = async () => {
    try {
      const response = await apiClient.get('/graph/knowledge-map');
      const graphData = response.data;
      
      if (graphData.nodes.length === 0) {
        // 友好提示
        setOption({ /* 空状态配置 */ });
      } else {
        // 正常配置
        setOption({ /* 图表配置 */ });
      }
      
      setLoading(false);
    } catch (error) {
      console.error('获取图谱数据失败', error);
      setLoading(false);
      // 可选: setError(error.message)
    }
  };
  fetchData();
}, []);
```

### 6.3 边界情况处理

1. **单个孤立节点**: 显示单个节点，无连线
2. **大量节点 (>100)**: ECharts 自动优化性能，必要时可添加虚拟化
3. **循环引用**: 正常显示双向边 (A→B, B→A)
4. **特殊字符标题**: 使用 `includes()` 方法正确处理
5. **极长标题**: ECharts label 配置自动换行或省略

---

## 7. UI/UX 设计 (User Interface)

### 7.1 页面布局

```
+--------------------------------------------------+
|  [导航栏] 主页 | AI助手 | 知识图谱 | [用户信息]   |
+--------------------------------------------------+
|  知识图谱                                         |
|  展示知识点之间的引用关系。点击节点可进行编辑。     |
|                                                  |
|  +--------------------------------------------+  |
|  |                                            |  |
|  |         [力导向图 - 600px 高度]            |  |
|  |                                            |  |
|  |   🔵 节点1  ------>  🟠 节点2              |  |
|  |     |                                      |  |
|  |     v                                      |  |
|  |   🔵 节点3                                 |  |
|  |                                            |  |
|  +--------------------------------------------+  |
|                                                  |
|  图例: 🔵 正常状态  🟠 需要复习                   |
+--------------------------------------------------+
```

### 7.2 颜色方案

| 状态 | 颜色代码 | 视觉效果 |
|------|---------|---------|
| 正常知识点 | #5B8FF9 | 蓝色 (ECharts 默认) |
| 需要复习 | #FF8C00 | 橙色 (DarkOrange) |
| 节点边框 | 默认 | 自动生成 |
| 连线 | #999 | 浅灰色 (ECharts 默认) |
| 高亮连线 | 继承节点颜色 | 强调效果 |

### 7.3 交互反馈

| 操作 | 反馈效果 | 实现方式 |
|------|---------|---------|
| 鼠标悬停节点 | 节点+相邻边高亮，显示 Tooltip | emphasis.focus: 'adjacency' |
| 点击节点 | 跳转到编辑页面 | onEvents.click + navigate |
| 拖拽节点 | 节点跟随鼠标移动 | ECharts 默认支持 |
| 拖拽画布 | 视图平移 | roam: true |
| 滚轮缩放 | 视图缩放 | roam: true |

### 7.4 Tooltip 样式

```html
<div style="padding: 10px; line-height: 1.6;">
  <strong style="font-size: 16px;">${nodeName}</strong><br/>
  <span style="color: #666;">难度: ${difficultyText}</span><br/>
  <span style="color: #999; font-size: 12px;">${formattedDate}</span>
</div>
```

难度映射:
- `beginner` → "初级"
- `intermediate` → "中级"
- `advanced` → "高级"

---

## 8. 测试策略 (Testing Strategy)

### 8.1 后端单元测试

**测试文件**: `tests/graph.test.js` (可选)

| 测试用例 | 验证目标 |
|---------|---------|
| 空知识点集合 | 返回 `{ nodes: [], links: [] }` |
| 单个知识点 | 返回 1 个节点，0 条边 |
| 两个互相引用的知识点 | 返回 2 个节点，2 条边 |
| 自引用检测 | 不创建自指向的边 |
| 无认证请求 | 返回 401 |
| 数据库错误 | 返回 500 |

**测试工具**: Jest + Supertest (如果项目已配置)

### 8.2 前端单元测试

**测试文件**: `src/pages/GraphPage.test.jsx` (可选)

| 测试用例 | 验证目标 |
|---------|---------|
| 组件挂载 | 调用 API 获取数据 |
| Loading 状态 | 显示"正在生成知识图谱..." |
| 空数据渲染 | 显示空图表或友好提示 |
| 点击节点 | 正确跳转到编辑页面 |
| 颜色编码 | reviewList=true 显示橙色 |

**测试工具**: Vitest + React Testing Library (如果项目已配置)

### 8.3 集成测试

**手动测试清单**:

1. **数据生成测试**
   - [ ] 使用 Postman 测试 API `/api/graph/knowledge-map`
   - [ ] 验证返回数据格式正确
   - [ ] 验证关系检测准确性

2. **前端渲染测试**
   - [ ] 启动前后端服务
   - [ ] 登录后访问 `/graph` 路由
   - [ ] 验证图表正常渲染
   - [ ] 验证节点颜色编码正确

3. **交互功能测试**
   - [ ] 拖拽画布平移
   - [ ] 滚轮缩放
   - [ ] 拖拽节点调整位置
   - [ ] 悬停节点高亮
   - [ ] 悬停显示 Tooltip
   - [ ] 点击节点跳转到编辑页

4. **边界情况测试**
   - [ ] 无知识点数据
   - [ ] 单个知识点
   - [ ] 大量知识点 (>50)
   - [ ] 无连接关系的知识点
   - [ ] 复杂引用网络

5. **兼容性测试**
   - [ ] Chrome 最新版
   - [ ] Firefox 最新版
   - [ ] Edge 最新版
   - [ ] 不同屏幕尺寸

### 8.4 性能测试

**测试指标**:
- API 响应时间 (目标: <3秒，100 个知识点)
- 图表渲染时间 (目标: <2秒)
- 交互响应时间 (目标: <100ms)

**测试方法**:
- 使用 Chrome DevTools Performance 面板
- 记录 API 调用时间
- 记录 React 渲染时间
- 记录 ECharts 初始化时间

---

## 9. 安全考虑 (Security Considerations)

### 9.1 认证与授权

- ✅ 所有 API 端点使用 `auth` 中间件保护
- ✅ 只返回当前用户的知识点数据
- ✅ JWT Token 通过 Authorization Header 传递
- ✅ Token 过期自动刷新 (apiClient 拦截器)

### 9.2 数据验证

- ✅ 后端: 使用 Mongoose Schema 验证
- ✅ 前端: 对 API 响应进行类型检查 (TypeScript 或运行时检查)
- ✅ 防止 XSS: ECharts 自动转义节点名称
- ✅ 防止 SQL 注入: 使用 Mongoose ORM

### 9.3 隐私保护

- ✅ 不暴露其他用户的知识点
- ✅ 图谱数据不缓存在客户端 (每次重新获取)
- ✅ 不记录敏感信息到日志

---

## 10. 部署与维护 (Deployment & Maintenance)

### 10.1 依赖安装

**后端**: 无新依赖 (使用现有 Express + Mongoose)

**前端**:
```bash
cd D:\feiman\feynman-platform-frontend
npm install echarts echarts-for-react
```

### 10.2 配置项

**可调整参数** (在代码中定义为常量，方便调整):

```javascript
// 后端: routes/graph.js
const NODE_VALUE_LENGTH = 100;           // 节点描述字符数
const SYMBOL_SIZE_BASE = 20;             // 节点基础大小
const SYMBOL_SIZE_FACTOR = 50;           // 大小计算因子
const SYMBOL_SIZE_MAX_INCREMENT = 30;    // 最大增量

// 前端: pages/GraphPage.jsx
const CHART_HEIGHT = '600px';            // 图表高度
const FORCE_REPULSION = 100;             // 斥力因子
const FORCE_EDGE_LENGTH = 50;            // 边长度
const EMPHASIS_LINE_WIDTH = 10;          // 高亮线宽
const COLOR_NORMAL = '#5B8FF9';          // 正常颜色
const COLOR_REVIEW = '#FF8C00';          // 复习颜色
```

### 10.3 监控与日志

**后端日志**:
- 记录 API 调用时间
- 记录错误堆栈 (`console.error`)
- (可选) 集成日志服务 (如 Winston)

**前端监控**:
- 使用 `console.error` 记录错误
- (可选) 集成错误追踪服务 (如 Sentry)

### 10.4 未来优化方向

1. **性能优化**
   - 实现关系数据缓存 (Redis)
   - 使用增量更新而非全量重建
   - 添加分页或虚拟化支持

2. **功能增强**
   - 支持多种关系类型 (引用、派生、对比等)
   - 添加图谱布局切换 (力导向、层级、圆形等)
   - 支持节点分组和筛选
   - 支持导出图谱为图片

3. **算法改进**
   - 使用 NLP 技术提取更精确的关系
   - 支持语义相似度计算
   - 添加关系强度权重

---

## 11. 实现检查清单 (Implementation Checklist)

### 后端
- [ ] 创建 `routes/graph.js` 文件
- [ ] 实现 `GET /knowledge-map` 端点
- [ ] 实现关系发现算法
- [ ] 在 `index.js` 中注册路由
- [ ] 测试 API 返回数据格式

### 前端
- [ ] 安装 `echarts` 和 `echarts-for-react`
- [ ] 创建 `src/pages/GraphPage.jsx`
- [ ] 实现数据获取逻辑
- [ ] 配置 ECharts option (力导向图)
- [ ] 实现颜色编码逻辑
- [ ] 实现 Tooltip 格式化
- [ ] 实现点击跳转功能
- [ ] 在 `App.jsx` 中添加路由
- [ ] 在 `Layout.jsx` 中添加导航链接

### 测试
- [ ] 后端 API 测试 (Postman)
- [ ] 前端页面渲染测试
- [ ] 交互功能测试
- [ ] 边界情况测试
- [ ] 跨浏览器兼容性测试

---

## 12. 关键设计决策 (Design Decisions)

### 12.1 为什么选择 ECharts?

**优势**:
- ✅ 功能强大，支持多种图表类型
- ✅ 力导向图性能优秀
- ✅ 配置灵活，易于定制
- ✅ 社区活跃，文档完善
- ✅ 有官方 React 封装 (echarts-for-react)

**对比 AntV G6**:
- G6 更专注于图可视化，功能更丰富
- 但 ECharts 对于本项目需求已足够，且学习成本更低

### 12.2 为什么使用简单的字符串匹配检测关系?

**原因**:
- ✅ 实现简单，易于理解和维护
- ✅ 对于结构化知识点内容有效
- ✅ 性能可接受 (100 个知识点以内)

**未来改进**:
- 使用 NLP 技术提取实体和关系
- 使用正则表达式匹配完整单词
- 添加权重和置信度评分

### 12.3 为什么节点颜色只区分两种状态?

**原因**:
- ✅ 简单直观，用户一目了然
- ✅ 与现有 reviewList 字段对应
- ✅ 颜色对比明显，易于识别

**未来扩展**:
- 可根据 difficulty 添加更多颜色
- 可根据 views/likes 调整透明度
- 可根据最近学习时间添加渐变

---

## 13. 参考资料 (References)

- [ECharts 官方文档 - Graph 力导向图](https://echarts.apache.org/zh/option.html#series-graph)
- [echarts-for-react GitHub](https://github.com/hustcc/echarts-for-react)
- [React Router v7 文档](https://reactrouter.com/)
- [Express.js 文档](https://expressjs.com/)
- [Mongoose 文档](https://mongoosejs.com/)

---

**文档版本**: v1.0  
**创建日期**: 2024-12-04  
**作者**: AI Assistant  
**状态**: 待审核
