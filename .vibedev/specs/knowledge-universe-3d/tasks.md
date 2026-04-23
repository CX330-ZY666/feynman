# 任务实施计划：knowledge-universe-3d

本文档包含实现 3D 知识宇宙可视化系统的所有编码任务。每个任务都是独立可执行的，并按照依赖顺序排列。

---

## 后端实现

### 1. 创建 KnowledgeRelation 数据模型
- [x] 1.1 创建 `models/KnowledgeRelation.js` 文件并实现 Mongoose Schema
  - 包含字段：source, target, type, relationLabel, author, timestamps
  - 添加复合唯一索引：`{ source: 1, target: 1, author: 1 }`
  - 添加查询优化索引：`{ author: 1, source: 1 }` 和 `{ author: 1, target: 1 }`
  - **关联需求**：需求 11.1（后端应创建 KnowledgeRelation Mongoose 模型）

### 2. 实现关系管理控制器
- [x] 2.1 创建 `controllers/knowledgeRelationsController.js` 文件并实现 `createRelation` 函数
  - 验证参数（source, target 必填）
  - 检查自关联（source !== target）
  - 验证节点存在且属于当前用户
  - 检查关系是否重复
  - 创建并保存关系记录
  - **关联需求**：需求 11.3, 11.6, 11.7

- [x] 2.2 实现 `getRelations` 函数
  - 查询当前用户的所有关系记录
  - 按 createdAt 降序排序
  - **关联需求**：需求 11.4

- [x] 2.3 实现 `deleteRelation` 函数
  - 查找关系记录
  - 验证所有权
  - 删除记录
  - **关联需求**：需求 11.5

### 3. 创建关系管理路由
- [x] 3.1 创建 `routes/knowledgeRelations.js` 文件并配置路由
  - POST `/api/relations` - 创建关系
  - GET `/api/relations` - 获取用户所有关系
  - DELETE `/api/relations/:id` - 删除关系
  - 所有路由使用 `auth` 中间件
  - **关联需求**：需求 11.2, 11.3, 11.4, 11.5

- [x] 3.2 在 `index.js` 中注册新路由
  - 添加 `app.use('/api/relations', require('./routes/knowledgeRelations'))`
  - **关联需求**：需求 11.2

### 4. 实现知识宇宙数据整合接口
- [x] 4.1 在 `routes/graph.js` 中添加 `/knowledge-universe` 端点
  - 查询用户所有知识点
  - 计算自动关系（相同 category + 共享 tag）
  - 查询手动关系
  - 合并并去重所有关系
  - 返回格式：`{ nodes: [...], links: [...] }`
  - **关联需求**：需求 12.1, 12.2, 12.3, 12.4, 12.5

- [x] 4.2 实现自动关系生成算法
  - 规则1：相同 category 的节点连接相邻节点（避免完全图）
  - 规则2：拥有共享 tag 的节点互相连接
  - 去重逻辑
  - **关联需求**：需求 7.1, 7.2, 7.3

---

## 前端基础设施

### 5. 安装前端依赖
- [x] 5.1 在 `feynman-platform-frontend` 目录安装 `d3-force-3d`
  - 执行命令：`npm install d3-force-3d`
  - **关联需求**：需求 4.1

### 6. 创建 KnowledgeUniversePage 组件基础结构
- [x] 6.1 创建 `src/pages/KnowledgeUniversePage.jsx` 文件
  - 设置基本的 React 组件结构
  - 定义所有必要的 state（knowledgePoints, relations, loading, error, editMode, selectedNode, showDetailPanel, dragStart, tempLine）
  - 定义所有必要的 refs（mountRef, sceneRef, cameraRef, rendererRef, controlsRef, raycasterRef, mouseRef, simulationRef, nodeObjectsRef, lineObjectsRef）
  - 添加空的 DOM 挂载点 `<div ref={mountRef} />`
  - **关联需求**：需求 1.1, 2.1

### 7. 配置路由
- [x] 7.1 在 `App.jsx` 中添加知识宇宙路由
  - 导入 KnowledgeUniversePage
  - 在 ProtectedRoute 内添加 `/knowledge-universe` 路由
  - **关联需求**：需求 14.1, 14.2, 14.4

- [x] 7.2 在 `Layout.jsx` 导航栏中添加"知识宇宙"菜单项
  - 添加链接到 `/knowledge-universe`
  - **关联需求**：需求 14.3

---

## 3D 场景初始化

### 8. 实现 Three.js 场景基础设置
- [x] 8.1 实现 `initThreeScene` 函数
  - 创建 Scene、PerspectiveCamera、WebGLRenderer
  - 设置黑色太空背景
  - 将渲染器 DOM 元素添加到 mountRef
  - **关联需求**：需求 1.1

- [x] 8.2 添加星空背景效果
  - 创建 10000 个星点的 Points 对象
  - 使用 BufferGeometry 和 PointsMaterial
  - 随机分布在 [-1000, 1000] 范围
  - **关联需求**：需求 1.2

- [x] 8.3 配置光照系统
  - 添加 AmbientLight（环境光）
  - 添加至少 2 个 DirectionalLight 或 PointLight
  - **关联需求**：需求 1.3

- [x] 8.4 添加 OrbitControls
  - 导入 `OrbitControls` from 'three/examples/jsm/controls/OrbitControls'
  - 启用阻尼效果（enableDamping: true）
  - **关联需求**：需求 1.1

- [x] 8.5 实现窗口大小自适应
  - 添加 window resize 事件监听
  - 更新相机 aspect 和渲染器 size
  - **关联需求**：需求 1.4

- [x] 8.6 实现清理函数
  - 在 useEffect cleanup 中移除事件监听
  - 销毁渲染器、控制器等资源
  - **关联需求**：需求 1.5

---

## 数据加载与节点渲染

### 9. 实现数据获取逻辑
- [ ] 9.1 实现 `fetchKnowledgePoints` 函数
  - 调用 `apiClient.get('/knowledge-points')`
  - 成功时更新 knowledgePoints state
  - 失败时设置 error state
  - **关联需求**：需求 2.1, 2.2, 2.3

- [ ] 9.2 实现 `fetchUniverseData` 函数（整合接口）
  - 调用 `apiClient.get('/graph/knowledge-universe')`
  - 解析 nodes 和 links 数据
  - 分离手动关系和自动关系
  - **关联需求**：需求 2.1, 2.2, 2.5, 需求 12.1

- [ ] 9.3 添加数据加载 useEffect
  - 在组件挂载时调用 fetchUniverseData
  - **关联需求**：需求 2.5

- [ ] 9.4 实现空数据状态显示
  - 当 knowledgePoints.length === 0 时显示"暂无知识点"提示
  - **关联需求**：需求 2.4, 需求 15.2

- [ ] 9.5 实现错误状态显示
  - 当 error 不为 null 时显示错误信息
  - **关联需求**：需求 2.3, 需求 15.1

### 10. 实现 3D 节点渲染
- [ ] 10.1 实现节点创建逻辑
  - 为每个知识点创建 SphereGeometry 和 MeshStandardMaterial
  - 赋予独特的颜色或纹理
  - 将元数据存储在 mesh.userData 中（id, title, content, category, originalColor, originalEmissive）
  - 添加到场景中
  - 将 mesh 存入 nodeObjectsRef Map
  - **关联需求**：需求 3.1, 3.2, 3.3

- [ ] 10.2 为每个节点创建文字标签
  - 使用 Canvas API 生成文字纹理
  - 创建 Sprite 对象
  - 定位在球体上方
  - **关联需求**：需求 3.4

- [ ] 10.3 实现节点性能优化（当节点 > 100 个时）
  - 使用共享的 geometry 实例
  - 考虑使用材质缓存
  - **关联需求**：需求 3.5, 需求 13.1

---

## 力导向布局

### 11. 集成 d3-force-3d
- [ ] 11.1 实现 `initForceSimulation` 函数
  - 导入 d3-force-3d
  - 准备力模拟数据格式（forceNodes, forceLinks）
  - 创建 3D 力模拟器
  - 配置力：forceManyBody (排斥力), forceCenter (中心力), forceLink (连线引力), forceCollide (碰撞检测)
  - **关联需求**：需求 4.2, 4.3

- [ ] 11.2 实现力模拟位置更新函数
  - 调用 simulation.tick()
  - 将计算出的坐标同步到 Three.js mesh.position
  - 同时更新连线的端点位置
  - **关联需求**：需求 4.4, 4.5

- [ ] 11.3 在动画循环中集成力模拟更新
  - 检查 simulation.alpha() 是否大于阈值
  - 达到平衡后降低计算频率（每 5 帧计算一次）
  - **关联需求**：需求 4.6, 需求 13.3

---

## 鼠标交互

### 12. 实现鼠标悬停高亮
- [ ] 12.1 实现鼠标移动事件处理
  - 添加 mousemove 事件监听
  - 将鼠标坐标转换为标准化设备坐标 (NDC)
  - **关联需求**：需求 5.1

- [ ] 12.2 实现 Raycaster 悬停检测
  - 在动画循环中使用 Raycaster 检测相交
  - 过滤出球体对象
  - **关联需求**：需求 5.1

- [ ] 12.3 实现节点高亮函数 `highlightNode`
  - 修改球体的 emissiveIntensity
  - 高亮与该节点相连的所有连线
  - **关联需求**：需求 5.2, 5.4

- [ ] 12.4 实现高亮恢复函数 `resetHighlight`
  - 恢复球体原始的 emissive 颜色和强度
  - 恢复连线的原始透明度和颜色
  - **关联需求**：需求 5.3, 5.5

### 13. 实现节点点击交互
- [ ] 13.1 实现鼠标点击事件处理
  - 添加 click 事件监听
  - 使用 Raycaster 检测点击的球体
  - **关联需求**：需求 6.1

- [ ] 13.2 实现节点选中逻辑
  - 更新 selectedNode state
  - 设置 showDetailPanel 为 true
  - **关联需求**：需求 6.1

- [ ] 13.3 实现点击空白区域取消选中
  - 当没有相交时清空 selectedNode
  - 设置 showDetailPanel 为 false
  - **关联需求**：需求 6.4

---

## 连线渲染

### 14. 实现自动连线渲染
- [ ] 14.1 实现自动连线渲染函数
  - 根据 links 数据创建 THREE.Line 对象
  - 使用蓝色材质标识自动连线
  - 设置适当的透明度和宽度
  - 将 line 存入 lineObjectsRef Map
  - **关联需求**：需求 7.4, 7.5

- [ ] 14.2 实现连线位置更新函数
  - 在力模拟更新后重新计算连线的端点位置
  - 更新 BufferGeometry 的 position 属性
  - **关联需求**：需求 4.5

- [ ] 14.3 实现连线数量限制（当 > 500 条时）
  - 只渲染前 500 条连线
  - **关联需求**：需求 7.6, 需求 13.2

---

## 编辑模式

### 15. 实现编辑模式切换
- [ ] 15.1 创建编辑模式切换按钮组件
  - 固定在右上角（position: fixed）
  - 显示当前模式状态
  - 点击切换 editMode state
  - **关联需求**：需求 10.2, 10.3

- [ ] 15.2 实现编辑模式提示显示
  - 当 editMode 为 true 时显示操作提示
  - **关联需求**：需求 10.1, 10.4

- [ ] 15.3 实现编辑模式切换逻辑
  - 添加 useEffect 监听 editMode 变化
  - 启用/禁用编辑相关的事件监听
  - **关联需求**：需求 10.5, 10.6

---

## 手动连线功能

### 16. 实现拖拽创建连线
- [ ] 16.1 实现 mousedown 事件处理
  - 检查 editMode 是否为 true
  - 使用 Raycaster 检测点击的球体
  - 设置 dragStart state（nodeId, position）
  - 创建临时连线对象
  - **关联需求**：需求 8.1, 8.2

- [ ] 16.2 实现 mousemove 事件处理（拖拽中）
  - 检查 dragStart 是否存在
  - 更新临时连线的终点为鼠标位置
  - 动态更新 BufferGeometry
  - **关联需求**：需求 8.2

- [ ] 16.3 实现 mouseup 事件处理（完成拖拽）
  - 使用 Raycaster 检测释放位置的球体
  - 如果是有效的目标节点，调用 API 创建关系
  - 清理临时连线
  - **关联需求**：需求 8.3

- [ ] 16.4 实现关系创建 API 调用
  - 调用 `apiClient.post('/relations', { source, target })`
  - 成功时添加新连线到场景
  - 使用黄色材质标识手动连线
  - 更新 relations state
  - **关联需求**：需求 8.4, 8.5

- [ ] 16.5 实现关系创建错误处理
  - 捕获 API 错误
  - 显示错误提示（重复关系、自关联等）
  - 撤销临时连线
  - **关联需求**：需求 8.6, 8.7

---

## 连线删除功能

### 17. 实现连线删除
- [ ] 17.1 实现连线右键点击事件处理
  - 添加 contextmenu 事件监听
  - 阻止默认右键菜单
  - 使用 Raycaster 检测点击的连线
  - **关联需求**：需求 9.1

- [ ] 17.2 实现删除确认对话框
  - 检查连线类型（manual 才能删除）
  - 显示确认对话框
  - **关联需求**：需求 9.2, 9.6

- [ ] 17.3 实现关系删除 API 调用
  - 调用 `apiClient.delete(\`/relations/\${relationId}\`)`
  - 成功时从场景中移除连线
  - 清理 lineObjectsRef
  - 更新 relations state
  - **关联需求**：需求 9.3, 9.4

- [ ] 17.4 实现删除错误处理
  - 捕获 API 错误
  - 保留连线并显示错误提示
  - **关联需求**：需求 9.5

---

## 详情浮层

### 18. 创建节点详情浮层组件
- [ ] 18.1 创建 NodeDetailPanel 组件
  - 接收 props: { node, visible, onClose }
  - 固定在右下角（position: fixed）
  - 宽度 300px，最大高度 500px
  - **关联需求**：需求 6.1

- [ ] 18.2 实现浮层内容渲染
  - 显示标题（title）
  - 显示分类（category）
  - 显示标签（tags）
  - 显示内容摘要（content 前 200 字符）
  - **关联需求**：需求 6.2

- [ ] 18.3 添加浮层样式
  - 阴影、圆角效果
  - 模糊背景（backdrop-filter: blur）
  - 平滑的进入/退出动画
  - **关联需求**：需求 6.5

- [ ] 18.4 实现关闭功能
  - 添加关闭按钮
  - 点击外部区域关闭（可选）
  - 调用 onClose 回调
  - **关联需求**：需求 6.3

---

## 错误处理与优化

### 19. 实现 WebGL 支持检测
- [ ] 19.1 实现 `checkWebGLSupport` 函数
  - 尝试获取 webgl context
  - 失败时设置 error state 并显示提示
  - **关联需求**：需求 15.3

### 20. 实现请求防重复提交
- [ ] 20.1 添加请求状态管理
  - 使用 ref 跟踪请求中的状态
  - 在请求进行中时禁用重复提交
  - **关联需求**：需求 15.5

### 21. 实现性能优化
- [ ] 21.1 实现 Raycaster 检测防抖
  - 使用 debounce 或节流优化 detectHover 调用频率
  - **关联需求**：需求 13.4

- [ ] 21.2 实现动画循环优化
  - 使用 requestAnimationFrame
  - 检测页面可见性，不可见时暂停动画
  - **关联需求**：需求 13.1, 13.5

---

## 测试

### 22. 编写后端单元测试
- [ ] 22.1 为 `createRelation` 编写测试用例
  - 测试成功创建关系
  - 测试自关联错误
  - 测试重复关系错误
  - 测试节点不存在错误
  - **关联需求**：需求 11.3, 11.6, 11.7

- [ ] 22.2 为 `getRelations` 编写测试用例
  - 测试成功获取关系列表
  - 测试按时间降序排序
  - **关联需求**：需求 11.4

- [ ] 22.3 为 `deleteRelation` 编写测试用例
  - 测试成功删除关系
  - 测试所有权验证
  - **关联需求**：需求 11.5

### 23. 编写前端组件测试
- [ ] 23.1 为 KnowledgeUniversePage 编写加载状态测试
  - 测试初始加载状态显示
  - 测试空数据状态显示
  - 测试错误状态显示
  - **关联需求**：需求 2.4, 需求 15.1, 15.2

- [ ] 23.2 为编辑模式切换编写测试
  - 测试默认浏览模式
  - 测试切换到编辑模式
  - 测试编辑功能启用/禁用
  - **关联需求**：需求 10.1, 10.3, 10.6

---

## 验证与集成

### 24. 端到端功能验证
- [ ] 24.1 编写集成测试：完整工作流
  - 测试登录 -> 加载知识点 -> 创建关系 -> 删除关系的完整流程
  - **关联需求**：需求 2.1, 8.4, 9.3

- [ ] 24.2 手动验证 3D 场景渲染
  - 启动开发服务器
  - 访问 `/knowledge-universe` 路由
  - 验证场景、节点、连线正常显示
  - **关联需求**：需求 1.1, 3.1, 7.4

- [ ] 24.3 手动验证交互功能
  - 验证鼠标悬停高亮
  - 验证点击显示详情
  - 验证编辑模式切换
  - 验证拖拽创建连线
  - 验证右键删除连线
  - **关联需求**：需求 5.2, 6.1, 8.2, 9.1

---

## 说明

- 所有任务均为编码任务，可由代码生成 LLM 执行
- 任务按依赖顺序排列，从后端基础设施到前端交互功能
- 每个任务都明确引用了相关的需求文档条目
- 测试任务分布在实现过程中，支持测试驱动开发
- 最后的验证任务确保所有功能正确集成
