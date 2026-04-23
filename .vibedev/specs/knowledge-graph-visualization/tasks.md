# 知识图谱可视化功能 - 实现任务清单

## 任务概览

本文档列出了实现知识图谱可视化功能的所有代码实现任务。每个任务都引用了具体的需求条目，并按照增量开发的方式组织，确保每一步都能独立测试和验证。

---

## 后端实现任务

### 1. 创建图谱路由文件
- [x] 1.1 创建 `routes/graph.js` 文件并配置基础 Express Router
  - 导入必要的依赖：`express`, `auth` 中间件, `KnowledgePoint` 模型
  - 创建并导出 Router 实例
  - **需求引用**: 8.1 - 系统应在后端项目中创建新的路由文件

- [x] 1.2 实现 `GET /knowledge-map` API 端点的基础结构
  - 添加路由定义：`router.get('/knowledge-map', auth, async (req, res) => {...})`
  - 实现基本的 try-catch 错误处理
  - 返回空数据结构 `{ nodes: [], links: [] }` 作为初始实现
  - **需求引用**: 1.1, 1.8 - 创建 API 端点并实现错误处理

### 2. 实现节点数据生成逻辑
- [x] 2.1 实现知识点查询和节点转换
  - 查询当前用户的所有知识点：`KnowledgePoint.find({ author: req.user.id })`
  - 将知识点转换为节点对象，包含字段：id, name, value, symbolSize, reviewList, difficulty, createdAt
  - 实现 symbolSize 计算公式：`20 + Math.min(content.length / 50, 30)`
  - **需求引用**: 1.2, 1.3 - 查询用户知识点并生成节点对象

- [x] 2.2 处理空数据边界情况
  - 检查知识点数组是否为空
  - 如果为空，直接返回 `{ nodes: [], links: [] }`
  - **需求引用**: 1.6, 9.3 - 处理无知识点数据的情况

### 3. 实现关系检测算法
- [x] 3.1 构建标题到 ID 的映射表
  - 创建 `Map` 对象，键为知识点标题，值为知识点 ID
  - 遍历所有知识点，填充映射表
  - **需求引用**: 1.4 - 生成关系数据时需要遍历所有知识点

- [x] 3.2 实现引用关系检测逻辑
  - 双层循环遍历所有知识点组合
  - 对每个知识点 A，检查其 content 是否包含其他知识点 B 的 title
  - 使用 `content.includes(title)` 进行匹配
  - 避免自引用：`if (sourceKp.title === targetTitle) continue`
  - **需求引用**: 1.4, 1.5, 10.1, 10.2 - 检测引用关系并避免自引用

- [x] 3.3 构建边数组
  - 当检测到引用关系时，创建 link 对象：`{ source: sourceId, target: targetId }`
  - 将所有 link 对象添加到 links 数组
  - **需求引用**: 1.5 - 创建边对象

### 4. 完善后端错误处理和响应
- [x] 4.1 完善错误处理逻辑
  - 在 catch 块中记录详细错误信息：`console.error('Error generating knowledge graph:', error)`
  - 返回 500 状态码和通用错误消息
  - **需求引用**: 1.8, 9.1 - 实现错误处理和日志记录

- [x] 4.2 验证 API 返回数据格式
  - 确保返回的 JSON 包含 `nodes` 和 `links` 两个数组
  - 验证节点对象包含所有必需字段
  - **需求引用**: 1.7, 10.5 - 返回 JSON 格式响应并保证数据安全

### 5. 注册图谱路由到主应用
- [x] 5.1 在 `index.js` 中注册图谱路由
  - 在现有路由注册代码后添加：`app.use('/api/graph', require('./routes/graph'))`
  - 确保注册位置在 `app.use('/api/ai', ...)` 之后，`app.listen()` 之前
  - **需求引用**: 8.3, 8.4 - 在主应用中注册路由

---

## 前端实现任务

### 6. 安装前端依赖
- [x] 6.1 安装 ECharts 和 React 封装库
  - 在前端项目目录执行：`npm install echarts echarts-for-react`
  - 验证依赖已添加到 `package.json`
  - **需求引用**: 2.1 - 在前端项目中安装必需的 npm 包

### 7. 创建 GraphPage 组件基础结构
- [x] 7.1 创建 `src/pages/GraphPage.jsx` 文件
  - 导入必要的 React hooks：`useState`, `useEffect`
  - 导入 `apiClient` 和 `useNavigate`
  - 导入 `ReactECharts` 组件
  - 定义基础组件结构和导出
  - **需求引用**: 2.2 - 创建新的页面组件

- [x] 7.2 实现组件状态管理
  - 定义 `option` 状态用于存储 ECharts 配置：`const [option, setOption] = useState({})`
  - 定义 `loading` 状态用于加载提示：`const [loading, setLoading] = useState(true)`
  - 初始化 `navigate` 函数用于路由跳转
  - **需求引用**: 2.4, 5.5 - 管理加载状态和路由导航

### 8. 实现数据获取逻辑
- [x] 8.1 实现 useEffect 数据获取
  - 在组件挂载时调用 API：`apiClient.get('/graph/knowledge-map')`
  - 在请求前设置 `loading` 为 `true`
  - 处理 API 响应，提取 `nodes` 和 `links` 数据
  - **需求引用**: 2.3 - 组件挂载时调用后端 API

- [x] 8.2 实现 API 错误处理
  - 使用 try-catch 捕获请求错误
  - 在控制台记录错误信息：`console.error('获取图谱数据失败', error)`
  - 设置 `loading` 为 `false`
  - **需求引用**: 2.5, 9.2 - 实现 API 调用失败的错误处理

### 9. 配置 ECharts 力导向图
- [x] 9.1 实现基础 ECharts 配置
  - 构建 `chartOption` 对象，设置 `type: 'graph'` 和 `layout: 'force'`
  - 设置 `data: graphData.nodes` 和 `links: graphData.links`
  - 配置 `roam: true` 以支持拖拽和缩放
  - **需求引用**: 3.1, 3.4, 5.6, 5.7 - 配置力导向图和交互功能

- [x] 9.2 配置力导向算法参数
  - 设置 `force.repulsion: 100` (节点斥力因子)
  - 设置 `force.edgeLength: 50` (边长度)
  - **需求引用**: 3.2 - 配置合理的视觉平衡参数

- [x] 9.3 配置节点标签显示
  - 设置 `label.show: true` 显示标签
  - 设置 `label.position: 'right'` 标签位置在节点右侧
  - 设置 `label.formatter: '{b}'` 显示节点名称
  - **需求引用**: 3.3 - 在节点旁显示名称标签

### 10. 实现节点颜色编码
- [x] 10.1 实现基于 reviewList 的颜色逻辑
  - 在构建 chartOption 时，处理每个节点的数据
  - 为每个节点添加 `itemStyle.color` 属性
  - 如果 `node.reviewList === true`，设置颜色为 `#FF8C00` (橙色)
  - 如果 `node.reviewList === false`，设置颜色为 `#5B8FF9` (蓝色)
  - **需求引用**: 4.1, 4.2, 4.3, 4.4 - 根据复习状态设置节点颜色

### 11. 实现交互功能
- [x] 11.1 配置鼠标悬停高亮效果
  - 设置 `emphasis.focus: 'adjacency'` 高亮节点及相邻边
  - 设置 `emphasis.lineStyle.width: 10` 增加悬停时的边宽度
  - **需求引用**: 5.1, 5.2 - 实现悬停高亮效果

- [x] 11.2 实现点击节点跳转功能
  - 定义 `onChartClick` 事件处理函数
  - 检查 `params.componentType === 'series'` 和 `params.dataType === 'node'`
  - 获取节点 ID：`params.data.id`
  - 使用 `navigate` 跳转到编辑页面：`navigate(\`/kp/edit/\${nodeId}\`)`
  - **需求引用**: 5.3, 5.4, 5.5 - 实现点击节点跳转

### 12. 实现 Tooltip 提示框
- [x] 12.1 配置 Tooltip 格式化函数
  - 在 chartOption 中添加 `tooltip` 配置对象
  - 实现 `tooltip.formatter` 函数，自定义 HTML 内容
  - 显示节点标题、难度级别、创建时间
  - **需求引用**: 6.1, 6.2, 6.3 - 启用并配置 Tooltip

- [x] 12.2 实现难度级别和日期格式化
  - 创建难度映射：`beginner` → "初级", `intermediate` → "中级", `advanced` → "高级"
  - 格式化 `createdAt` 为易读的日期时间格式 (如: `new Date(date).toLocaleString('zh-CN')`)
  - 构建包含样式的 HTML 字符串
  - **需求引用**: 6.3, 6.4, 6.5 - 显示格式化的详细信息

### 13. 实现组件渲染逻辑
- [x] 13.1 实现加载状态渲染
  - 如果 `loading === true`，返回 `<p>正在生成知识图谱...</p>`
  - **需求引用**: 2.4 - 显示加载提示

- [x] 13.2 实现空数据友好提示
  - 检查 `graphData.nodes.length === 0`
  - 显示友好提示信息：如 "暂无知识点数据，请先添加知识点"
  - **需求引用**: 9.3 - 处理空数据情况

- [x] 13.3 实现图表渲染
  - 使用 `ReactECharts` 组件渲染图表
  - 传入 `option` prop
  - 设置 `style={{ height: '600px', width: '100%' }}`
  - 绑定 `onEvents={{ 'click': onChartClick }}`
  - **需求引用**: 3.5, 5.3 - 渲染图表并绑定事件

### 14. 添加页面标题和说明
- [x] 14.1 添加页面标题和描述文本
  - 在图表上方添加 `<h1>知识图谱</h1>`
  - 添加说明文字：`<p>展示知识点之间的引用关系。点击节点可进行编辑。</p>`
  - (可选) 添加颜色图例说明
  - **需求引用**: 用户体验优化

---

## 路由和导航集成

### 15. 配置前端路由
- [x] 15.1 在 `App.jsx` 中添加图谱页面路由
  - 导入 `GraphPage` 组件
  - 在 `ProtectedRoute` 包裹的路由组中添加：`<Route path="/graph" element={<GraphPage />} />`
  - 确保路由位置在 `<Route path="/agent" .../>` 之后
  - **需求引用**: 7.1, 7.4 - 添加路由并保护访问

### 16. 添加导航链接
- [x] 16.1 在 `Layout.jsx` 中添加知识图谱导航链接
  - 在导航栏的 token 判断块中添加链接
  - 添加代码：`<Link to="/graph" style={{ marginRight: '1rem' }}>知识图谱</Link>`
  - 确保位置在 "AI助手" 链接之后
  - **需求引用**: 7.2, 7.3 - 在导航菜单中添加链接

---

## 测试和验证

### 17. 后端 API 测试
- [ ] 17.1 编写后端 API 手动测试脚本或使用工具测试
  - 使用 Postman 或类似工具测试 `GET /api/graph/knowledge-map`
  - 验证认证 Token 正确传递
  - 验证返回数据格式符合预期
  - 测试空知识点情况
  - 测试多个知识点的关系检测
  - **需求引用**: 1.7, 10.1, 10.2, 10.3 - 验证数据格式和关系准确性

### 18. 前端集成测试
- [ ] 18.1 手动测试前端图表渲染
  - 启动前后端服务
  - 登录后访问 `/graph` 路由
  - 验证图表正常渲染
  - 验证节点颜色编码正确 (reviewList=true 为橙色)
  - **需求引用**: 4.2, 4.3 - 验证颜色编码

- [ ] 18.2 测试所有交互功能
  - 测试鼠标拖拽画布平移
  - 测试鼠标滚轮缩放
  - 测试拖拽单个节点调整位置
  - 测试鼠标悬停节点高亮效果
  - 测试悬停显示 Tooltip
  - 测试点击节点跳转到编辑页
  - **需求引用**: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7, 5.8, 6.2 - 验证所有交互功能

### 19. 边界情况和错误处理测试
- [ ] 19.1 测试边界情况
  - 测试无知识点数据的情况
  - 测试单个知识点 (无连接)
  - 测试大量知识点 (>50 个) 性能
  - 测试无连接关系的多个知识点
  - 测试循环引用 (A→B, B→A)
  - **需求引用**: 9.3, 9.4, 9.5, 10.3 - 验证边界情况处理

- [ ] 19.2 测试错误处理
  - 测试 API 调用失败时的前端表现
  - 测试后端数据库错误时的响应
  - 验证错误信息正确记录到控制台
  - **需求引用**: 9.1, 9.2 - 验证错误处理

---

## 代码优化和重构

### 20. 代码质量优化
- [ ] 20.1 添加关键函数注释
  - 为关系检测算法添加注释说明
  - 为 ECharts 配置添加注释
  - 为事件处理函数添加注释
  - **需求引用**: 非功能性需求 - 可维护性

- [ ] 20.2 提取可配置常量
  - 将魔法数字提取为常量 (如节点大小计算参数、颜色代码等)
  - 在文件顶部定义配置常量
  - **需求引用**: 非功能性需求 - 可维护性

---

## 任务执行说明

**执行顺序**:
1. 先完成后端任务 (任务 1-5)，确保 API 正常工作
2. 再完成前端任务 (任务 6-14)，实现图表渲染
3. 然后完成路由集成 (任务 15-16)，连接前后端
4. 最后进行测试和优化 (任务 17-20)

**测试策略**:
- 每完成一个主要模块，立即进行单元测试
- 使用 Postman 或 curl 测试后端 API
- 使用浏览器开发者工具测试前端功能
- 在真实环境中进行端到端测试

**注意事项**:
- 所有文件路径都是相对于项目根目录的绝对路径
- 后端项目根目录: `D:\feiman\feynman-platform-backend`
- 前端项目根目录: `D:\feiman\feynman-platform-frontend`
- 确保在修改代码前备份重要文件
- 遵循项目现有的代码风格和命名规范

---

**任务统计**:
- 后端任务: 9 个子任务
- 前端任务: 18 个子任务
- 集成任务: 2 个子任务
- 测试任务: 4 个子任务
- 优化任务: 2 个子任务
- **总计**: 35 个可执行子任务
