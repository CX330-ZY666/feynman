# 知识图谱可视化功能需求文档

## 功能概述

为费曼学习平台添加知识图谱可视化功能，使用 ECharts 图表库以力导向图的形式展示知识点之间的引用关系网络。用户可以通过可视化的方式直观地理解知识点之间的关联关系，并通过交互操作（拖拽、缩放、点击）探索知识结构。系统将根据知识点的复习状态（reviewList）使用不同颜色进行标识，帮助用户快速识别需要复习的内容。

---

## 需求列表

### 1. 后端图谱数据生成

**用户故事**  
作为一个学习者，我希望系统能够自动分析我的知识点内容并生成知识图谱数据，这样我就可以看到知识点之间的引用关系网络。

**验收标准**

1.1. WHEN 用户通过认证后发起图谱数据请求，THE 系统 SHALL 创建新的 API 端点 `GET /api/graph/knowledge-map`。

1.2. WHEN API 接收到请求，THE 系统 SHALL 查询当前用户的所有知识点记录。

1.3. WHEN 系统处理知识点数据时，THE 系统 SHALL 为每个知识点生成节点对象，包含以下字段：
   - `id`: 知识点的唯一标识（_id 转为字符串）
   - `name`: 知识点标题
   - `value`: 知识点内容的前 100 个字符
   - `symbolSize`: 根据内容长度动态计算（基础值 20 + min(content.length/50, 30)）
   - `reviewList`: 复习标记状态（布尔值）
   - `difficulty`: 难度级别
   - `createdAt`: 创建时间

1.4. WHEN 系统生成关系数据时，THE 系统 SHALL 遍历所有知识点，检查每个知识点 A 的 content 字段是否包含其他知识点 B 的 title 字段。

1.5. IF 知识点 A 的内容中包含知识点 B 的标题，THE 系统 SHALL 创建一条从 A 到 B 的边（link），包含 `source` 和 `target` 字段。

1.6. IF 用户没有任何知识点，THE 系统 SHALL 返回空的节点数组和边数组 `{nodes: [], links: []}`。

1.7. WHEN 数据生成完成后，THE 系统 SHALL 返回 JSON 格式的响应，包含 `nodes` 数组和 `links` 数组。

1.8. IF 处理过程中发生错误，THE 系统 SHALL 记录错误日志并返回 500 状态码和错误消息。

---

### 2. 前端图表库集成

**用户故事**  
作为一个开发者，我希望在前端项目中集成 ECharts 图表库，这样我就可以使用专业的可视化组件来渲染知识图谱。

**验收标准**

2.1. THE 系统 SHALL 在前端项目中安装 `echarts` 和 `echarts-for-react` 两个 npm 包。

2.2. THE 系统 SHALL 创建新的页面组件 `src/pages/GraphPage.jsx`。

2.3. THE 组件 SHALL 在挂载时调用后端 API `/api/graph/knowledge-map` 获取图谱数据。

2.4. WHEN 数据加载中时，THE 组件 SHALL 显示"正在生成知识图谱..."的加载提示。

2.5. IF API 调用失败，THE 组件 SHALL 在控制台记录错误信息并保持加载状态为 false。

---

### 3. 力导向图渲染与配置

**用户故事**  
作为一个学习者，我希望看到一个布局合理、视觉清晰的力导向图谱，这样我就能够直观地理解知识点之间的关系结构。

**验收标准**

3.1. THE 图表 SHALL 使用 ECharts 的 `graph` 类型，并设置布局模式为 `force`（力导向）。

3.2. THE 图表 SHALL 配置节点斥力因子（repulsion）为 100，边长度（edgeLength）为 50，以达到合理的视觉平衡。

3.3. THE 图表 SHALL 在每个节点右侧显示节点名称标签。

3.4. THE 图表 SHALL 设置 `roam: true`，允许用户通过鼠标进行缩放和平移操作。

3.5. THE 图表 SHALL 设置高度为 600px，宽度为 100%，自适应容器宽度。

3.6. WHEN 图表渲染完成后，THE 节点 SHALL 根据力导向算法自动计算位置并呈现动态平衡状态。

---

### 4. 节点状态颜色标识

**用户故事**  
作为一个学习者，我希望图谱中的节点能够根据复习状态显示不同的颜色，这样我就可以快速识别哪些知识点需要复习。

**验收标准**

4.1. WHEN 后端返回的节点数据包含 `reviewList` 字段时，THE 前端 SHALL 根据该字段值设置节点颜色。

4.2. IF `reviewList` 为 `true`（需要复习），THE 节点 SHALL 显示为橙色（#FF8C00 或类似颜色）。

4.3. IF `reviewList` 为 `false`（正常状态），THE 节点 SHALL 显示为蓝色（ECharts 默认蓝色 #5B8FF9 或类似颜色）。

4.4. THE 节点样式配置 SHALL 在 ECharts 的 option 中通过 `itemStyle.color` 属性实现。

---

### 5. 交互功能实现

**用户故事**  
作为一个学习者，我希望能够与图谱进行交互操作，这样我就可以探索知识结构并快速访问特定的知识点。

**验收标准**

5.1. WHEN 用户将鼠标悬停在节点上时，THE 图表 SHALL 高亮显示该节点及其相邻的边（使用 `emphasis.focus: 'adjacency'` 配置）。

5.2. WHEN 用户将鼠标悬停在边上时，THE 边的宽度 SHALL 增加到 10 像素（使用 `emphasis.lineStyle.width` 配置）。

5.3. WHEN 用户点击图谱中的节点时，THE 系统 SHALL 触发点击事件处理函数。

5.4. WHEN 点击事件被触发且点击的是节点（`params.dataType === 'node'`）时，THE 系统 SHALL 获取节点的 ID。

5.5. WHEN 获取到节点 ID 后，THE 系统 SHALL 使用 React Router 的 `navigate` 函数跳转到该知识点的编辑页面 `/kp/edit/{nodeId}`。

5.6. THE 用户 SHALL 能够通过鼠标拖拽画布来平移视图。

5.7. THE 用户 SHALL 能够通过鼠标滚轮缩放画布。

5.8. THE 用户 SHALL 能够拖拽单个节点来手动调整其位置（ECharts graph 默认支持）。

---

### 6. Tooltip 提示框功能

**用户故事**  
作为一个学习者，我希望鼠标悬停在节点上时能看到更详细的信息提示，这样我就能快速了解知识点的关键属性而无需点击进入。

**验收标准**

6.1. THE 图表 SHALL 配置 `tooltip` 对象以启用提示框功能。

6.2. WHEN 用户将鼠标悬停在节点上时，THE 系统 SHALL 显示一个浮动提示框。

6.3. THE 提示框 SHALL 显示以下信息：
   - 知识点标题（name）
   - 难度级别（difficulty）- 显示为中文：beginner=初级, intermediate=中级, advanced=高级
   - 创建时间（createdAt）- 格式化为易读的日期时间格式

6.4. THE 提示框 SHALL 使用自定义格式化函数（`tooltip.formatter`）来渲染 HTML 内容。

6.5. THE 提示框样式 SHALL 清晰美观，与整体界面风格保持一致。

---

### 7. 路由与导航集成

**用户故事**  
作为一个学习者，我希望能够方便地从主导航访问知识图谱页面，这样我就可以随时查看我的知识网络。

**验收标准**

7.1. THE 系统 SHALL 在 `App.jsx` 中添加新路由 `/graph`，指向 `GraphPage` 组件。

7.2. THE 系统 SHALL 在 `Layout.jsx` 组件的导航菜单中添加"知识图谱"链接。

7.3. WHEN 用户点击"知识图谱"链接时，THE 系统 SHALL 导航到 `/graph` 路由。

7.4. THE 路由 SHALL 受到认证保护（如果其他页面也有保护机制）。

---

### 8. 后端路由注册

**用户故事**  
作为一个开发者，我希望新的图谱 API 能够正确注册到 Express 应用中，这样前端才能成功调用该接口。

**验收标准**

8.1. THE 系统 SHALL 在后端项目中创建新的路由文件 `routes/graph.js`。

8.2. THE 路由文件 SHALL 导出一个 Express Router 实例。

8.3. THE 系统 SHALL 在 `index.js` 中通过 `app.use('/api/graph', require('./routes/graph'))` 注册图谱路由。

8.4. THE 路由注册 SHALL 在其他路由注册之后、服务器启动之前完成。

---

### 9. 错误处理与边界情况

**用户故事**  
作为一个用户，我希望系统能够优雅地处理各种异常情况，这样即使出现问题我也能得到清晰的反馈。

**验收标准**

9.1. IF 后端数据库查询失败，THE 系统 SHALL 捕获错误、记录日志并返回 500 状态码。

9.2. IF 前端 API 调用失败（网络错误、认证失败等），THE 组件 SHALL 在控制台记录错误并停止加载状态。

9.3. IF 用户没有任何知识点数据，THE 图表页面 SHALL 显示空图表或友好的提示信息（如"暂无知识点数据，请先添加知识点"）。

9.4. IF 图谱数据中没有任何连接关系（links 为空），THE 图表 SHALL 仍然正常显示所有节点，只是没有连线。

9.5. IF 节点数量非常大（例如超过 100 个），THE 图表渲染性能 SHALL 保持流畅，不应出现明显卡顿。

---

### 10. 数据完整性与准确性

**用户故事**  
作为一个学习者，我希望图谱准确反映知识点之间的真实引用关系，这样我才能信任这个可视化工具。

**验收标准**

10.1. WHEN 系统检测引用关系时，THE 匹配算法 SHALL 准确识别 title 在 content 中的出现。

10.2. THE 系统 SHALL 避免自引用（节点不应连接到自身）。

10.3. IF 知识点 A 和 B 互相引用，THE 图谱 SHALL 显示两条有向边（A→B 和 B→A）。

10.4. THE 节点大小（symbolSize）SHALL 合理反映知识点内容的长度，但有上下限控制以避免过大或过小。

10.5. THE 系统 SHALL 只显示当前登录用户自己的知识点，不应泄露其他用户的数据。

---

## 非功能性需求

### 性能要求
- 图谱数据生成时间应在 3 秒内完成（100 个知识点以内）
- 前端图表渲染应在 2 秒内完成
- 交互响应时间（悬停、点击）应小于 100ms

### 兼容性要求
- 支持主流浏览器：Chrome、Firefox、Edge、Safari 最新版本
- 图表应支持响应式布局，在不同屏幕尺寸下正常显示

### 可维护性要求
- 代码应遵循项目现有的编码规范
- 关键函数应添加注释说明
- 配置参数应易于调整（如节点颜色、斥力系数等）

---

## 技术约束

- 后端框架：Express.js
- 数据库：MongoDB with Mongoose
- 前端框架：React 18
- 路由库：React Router 7
- 可视化库：ECharts + echarts-for-react
- 认证方式：JWT（使用现有的 auth 中间件）

---

## 依赖关系

- 依赖现有的 `KnowledgePoint` 模型
- 依赖现有的 `auth` 中间件
- 依赖现有的前端 API 客户端配置（`apiClient`）
- 依赖现有的路由和布局结构
