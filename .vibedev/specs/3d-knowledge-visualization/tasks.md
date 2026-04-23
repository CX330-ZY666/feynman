# 3D 知识图谱可视化 - 实现任务清单

## 阶段一：环境准备与基础 3D 场景

- [x] 1. 安装 Three.js 依赖
  - 在 `feynman-platform-frontend` 目录下执行 `npm install three`
  - 验证 `package.json` 中添加了 `three@^0.161.0` 依赖
  - 需求引用：1.1, 1.2

- [x] 2. 创建基础 ThreeJSPage 组件文件
  - 创建 `src/pages/ThreeJSPage.jsx` 文件
  - 导入必要的 React Hooks (useState, useEffect, useRef)
  - 导入 Three.js 核心模块和 OrbitControls
  - 创建基本组件结构，包含返回空 div 的 JSX
  - 需求引用：1.1, 1.2

- [x] 3. 实现 Three.js 场景初始化逻辑
  - 在 ThreeJSPage 组件中添加 mountRef 用于引用 DOM 容器
  - 实现 useEffect 钩子，在组件挂载时初始化 Three.js
  - 创建 Scene 并设置背景色为 0x1a2a3a
  - 创建 PerspectiveCamera (fov=75, aspect=width/height, near=0.1, far=1000)
  - 设置相机位置 position.z = 5
  - 需求引用：1.1, 1.2, 4.3

- [x] 4. 创建 WebGL 渲染器并挂载到 DOM
  - 创建 WebGLRenderer 实例，启用 antialias
  - 设置渲染器尺寸为容器的 clientWidth 和 clientHeight
  - 将 renderer.domElement 添加到 mountRef.current
  - 需求引用：1.1, 6.4

- [x] 5. 添加旋转立方体到场景
  - 创建 BoxGeometry (1, 1, 1)
  - 创建 MeshBasicMaterial，颜色为 0x00ff00 (绿色)
  - 组合为 Mesh 并添加到场景
  - 需求引用：1.2

- [x] 6. 实现动画循环和立方体旋转
  - 创建 animate 函数，使用 requestAnimationFrame 递归调用
  - 在动画循环中每帧增加立方体的 rotation.x 和 rotation.y (每帧 +0.01)
  - 调用 renderer.render(scene, camera) 渲染场景
  - 在 useEffect 中启动 animate 函数
  - 需求引用：1.3

- [x] 7. 添加轨道控制器 (OrbitControls)
  - 创建 OrbitControls 实例，传入 camera 和 renderer.domElement
  - 设置 enableDamping = true 启用阻尼效果
  - 在动画循环中调用 controls.update()
  - 需求引用：1.4, 1.5, 1.6

- [x] 8. 实现窗口大小自适应
  - 创建 handleResize 函数
  - 更新相机的 aspect 属性为新的宽高比
  - 调用 camera.updateProjectionMatrix()
  - 调用 renderer.setSize() 更新渲染器尺寸
  - 添加 window resize 事件监听器
  - 需求引用：1.7

- [x] 9. 实现组件卸载时的资源清理
  - 在 useEffect 返回清理函数
  - 移除 resize 事件监听器
  - 从 DOM 中移除 renderer.domElement
  - 调用 renderer.dispose() 和 controls.dispose()
  - 需求引用：6.1, 6.2, 6.3

- [x] 10. 配置路由和导航
  - 在 `src/App.jsx` 中导入 ThreeJSPage
  - 在受保护路由 (ProtectedRoute) 中添加 `/3d-world` 路由
  - 在 `src/components/Layout.jsx` 的导航栏中添加"3D 视界"链接
  - 链接指向 `/3d-world` 路径
  - 需求引用：2.1, 2.2, 2.3

---

## 阶段二：3D 知识图谱渲染

- [x] 11. 添加图谱数据获取逻辑
  - 在 ThreeJSPage 组件中导入 apiClient
  - 添加 useState 管理 graphData (初始值为 { nodes: [], links: [] })
  - 创建独立的 useEffect 钩子获取 `/graph/knowledge-map` 数据
  - 使用 try-catch 处理 API 错误并在控制台输出
  - 需求引用：3.1, 7.1

- [x] 12. 重构 Three.js 初始化逻辑以依赖图谱数据
  - 修改 Three.js 初始化的 useEffect，依赖 graphData
  - 添加条件判断：if (graphData.nodes.length === 0) return
  - 确保只有在数据就绪后才初始化场景
  - 移除之前的立方体创建代码
  - 需求引用：7.2

- [x] 13. 实现节点随机位置生成函数
  - 创建 getRandomPosition 辅助函数
  - 返回 THREE.Vector3，x/y/z 范围为 [-5, 5]
  - 公式：(Math.random() - 0.5) * 10
  - 需求引用：3.4, 3.8

- [x] 14. 创建节点对象映射表
  - 使用 useRef 创建 nodeObjectsRef，初始值为 new Map()
  - 用于存储节点 id 到 Three.js Mesh 对象的映射
  - 需求引用：3.7

- [x] 15. 渲染知识点节点为 3D 球体
  - 创建共享的 SphereGeometry (radius=0.2, widthSegments=32, heightSegments=32)
  - 遍历 graphData.nodes，为每个节点：
    - 创建 MeshStandardMaterial，随机颜色 (Math.random() * 0xffffff)
    - 创建 Mesh 并设置随机位置 (使用 getRandomPosition)
    - 在 mesh.userData 中存储 { id: node.id, label: node.name }
    - 添加到 scene 并存入 nodeObjectsRef.current
  - 需求引用：3.2, 3.3, 3.4, 3.7

- [x] 16. 创建边关联关系映射表
  - 使用 useRef 创建 edgesByNodeIdRef，初始值为 new Map()
  - 结构：nodeId => [Line1, Line2, ...]
  - 需求引用：5.3

- [x] 17. 渲染节点间的连线
  - 创建共享的 LineBasicMaterial (color=0xaaaaaa, transparent=true, opacity=0.5)
  - 遍历 graphData.links，为每条边：
    - 从 nodeObjectsRef 获取 source 和 target 节点
    - 如果任一节点不存在则跳过 (边界条件处理)
    - 使用 BufferGeometry.setFromPoints 创建线条几何体
    - 创建 Line 对象并添加到场景
    - 将 Line 添加到 edgesByNodeIdRef 的对应节点列表中
  - 需求引用：3.5, 3.6, 7.3

- [x] 18. 添加光照系统
  - 创建 AmbientLight (color=0xffffff, intensity=0.5) 并添加到场景
  - 创建 PointLight (color=0xffffff, intensity=1)
  - 设置点光源位置为 (5, 5, 5)
  - 将点光源添加到场景
  - 需求引用：4.1, 4.2

---

## 阶段三：鼠标悬停高亮交互

- [x] 19. 初始化射线投射相关引用
  - 使用 useRef 创建 raycasterRef，初始值为 new THREE.Raycaster()
  - 使用 useRef 创建 mouseRef，初始值为 new THREE.Vector2()
  - 使用 useRef 创建 hoveredObjectRef，初始值为 null (跟踪当前悬停对象)
  - 需求引用：5.1, 5.6

- [x] 20. 实现鼠标坐标归一化函数
  - 创建 handleMouseMove 事件处理函数
  - 获取容器的 getBoundingClientRect()
  - 计算归一化设备坐标 (NDC)：
    - mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    - mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  - 添加 mousemove 事件监听器到容器元素
  - 需求引用：5.5

- [x] 21. 实现节点高亮和恢复函数
  - 创建 highlightNode(mesh) 函数：
    - 设置 mesh.material.emissive.setHex(0xff0000)
    - 从 edgesByNodeIdRef 获取相连的边
    - 将所有相连边的 opacity 设置为 1.0
  - 创建 resetHighlight(mesh) 函数：
    - 设置 mesh.material.emissive.setHex(0x000000)
    - 将所有相连边的 opacity 恢复为 0.5
  - 需求引用：5.2, 5.3, 5.4

- [x] 22. 在动画循环中集成射线检测
  - 在 animate 函数中，controls.update() 之后添加射线检测逻辑
  - 调用 raycasterRef.current.setFromCamera(mouseRef.current, camera)
  - 筛选场景中的球体对象 (type==='Mesh' && geometry.type==='SphereGeometry')
  - 调用 raycasterRef.current.intersectObjects(spheres)
  - 如果有相交：
    - 取第一个相交对象 (最近的)
    - 如果与之前的悬停对象不同：
      - 恢复之前对象的高亮 (如果存在)
      - 高亮新对象
      - 更新 hoveredObjectRef.current
  - 如果无相交：
    - 恢复之前对象的高亮 (如果存在)
    - 将 hoveredObjectRef.current 设置为 null
  - 需求引用：5.1, 5.6

- [x] 23. 清理鼠标事件监听器
  - 在组件卸载的清理函数中移除 mousemove 事件监听器
  - 需求引用：6.2

---

## 阶段四：测试与优化

- [x] 24. 手动测试基础功能
  - 启动前端开发服务器 (npm run dev)
  - 登录系统并导航到"3D 视界"页面
  - 验证旋转立方体是否正确显示 (如果还未切换到图谱数据)
  - 验证轨道控制器的三种交互 (左键旋转、滚轮缩放、右键平移)

- [x] 25. 手动测试 3D 知识图谱渲染
  - 确认页面能正确获取图谱数据
  - 验证节点是否渲染为球体并随机分布
  - 验证边是否正确连接两个节点
  - 验证光照效果是否正常 (球体有明暗过渡)

- [x] 26. 手动测试鼠标悬停高亮
  - 移动鼠标到球体上，验证球体是否变红
  - 验证相连的边是否变亮
  - 移开鼠标，验证高亮是否恢复
  - 快速移动鼠标在多个球体间，验证切换是否流畅

- [x] 27. 测试边界条件
  - 测试空数据情况 (无知识点时)
  - 测试单个节点情况
  - 测试大量节点情况 (如果数据允许)
  - 测试窗口调整大小的响应性

- [x] 28. 验证资源清理
  - 使用浏览器 DevTools 的 Performance 面板
  - 多次进入和退出 3D 视界页面
  - 观察内存是否有明显增长 (内存泄漏检测)
  - 验证事件监听器是否正确移除

---

## 说明

- 所有任务均为可编码实现的任务
- 每个任务都引用了需求文档中的具体验收标准编号
- 任务按照渐进式顺序组织，后续任务依赖前面的任务
- 测试任务仅包含可在开发环境中执行的手动验证
- 不包含生产部署、用户培训等非编码任务
