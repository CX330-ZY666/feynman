好的，这是为您的《大前端与AI实战》实训课程设计的第十四次课程的详细内容。本次课程将直接承接上一节课的`Three.js`基础，进入一个令人兴奋的高级应用阶段：将我们的知识点数据真正地在三维空间中“活”起来，构建一个动态、可交互的3D知识宇宙。

---

### **《大前端与AI实战》第十四次课程：Three.js进阶：构建3D知识宇宙**

**课程主题：** 数据驱动的可视化：亲手创造你的知识星系
**总时长：** 4学时 (约3-3.5小时教学，半小时答疑与休息)

#### **一、 本次课程目标 (Objectives)**

在本次课程结束后，每位同学都应该能够：
1.  **理解** 数据驱动的3D可视化的基本思想。
2.  **掌握** 如何将后端获取的知识点数据动态生成为3D场景中的节点（`Node`）。
3.  **理解** 力导向图（Force-Directed Graph）的基本原理，并使用 `d3-force-3d` 库来自动布局3D空间中的节点。
4.  **实现** 节点之间的连接线（`Edge`），初步构建知识图谱的视觉形态。
5.  **为3D场景添加交互**：使用 `Raycaster` 实现鼠标拾取，当点击一个知识点节点时，高亮该节点并显示其信息。
6.  **优化性能**：了解在处理大量3D对象时的一些基本性能优化策略。

#### **二、 核心关键词 (Keywords)**

*   数据驱动 (Data-Driven)
*   力导向图 (Force-Directed Graph)
*   `d3-force-3d`
*   节点 (Node) / 边 (Edge)
*   `Raycaster` (光线投射)
*   鼠标拾取 (Mouse Picking)
*   `TWEEN.js` (补间动画)

---

### **三、 详细教学流程 (Step-by-Step Guide)**

---

#### **第一部分：从数据到3D对象 (约60分钟)**

**教师讲解与带领编码：**

1.  **回顾与目标**
    *   “上节课，我们已经掌握了`Three.js`的基础，能创建场景、相机、灯光和基本物体。今天，我们要把这些静态的方块变成动态的、有生命的‘知识星球’。我们的目标是：从后端API获取所有知识点数据，然后为每一个知识点在3D空间中创建一个对应的星球。”

2.  **创建3D知识宇宙页面组件**
    *   在 `src/pages` 下新建 `KnowledgeUniversePage.jsx`。
    *   将上一节课 `ThreejsPage.jsx` 的基础代码（场景、相机、渲染器、灯光、动画循环等）复制过来作为起点。
    *   在 `App.jsx` 中为其配置路由，并在导航栏添加入口。

3.  **获取数据并生成节点**
    *   **在 `KnowledgeUniversePage.jsx` 中获取数据：**
        ```jsx
        // KnowledgeUniversePage.jsx
        import { useEffect, useRef, useState } from 'react';
        import * as THREE from 'three';
        import apiClient from '../api/axios';
        // ... (其他引入)

        function KnowledgeUniversePage() {
            const mountRef = useRef(null);
            const [knowledgePoints, setKnowledgePoints] = useState([]);

            // 1. 获取知识点数据
            useEffect(() => {
                apiClient.get('/knowledge-points')
                    .then(res => setKnowledgePoints(res.data))
                    .catch(err => console.error('Failed to fetch knowledge points', err));
            }, []);

            // 2. 当数据加载后，初始化3D场景
            useEffect(() => {
                if (knowledgePoints.length === 0) return;

                // --- Three.js 基础设置 (从上节课复制) ---
                const scene = new THREE.Scene();
                const camera = new THREE.PerspectiveCamera(/* ... */);
                const renderer = new THREE.WebGLRenderer(/* ... */);
                // ... 灯光、控制器等

                // --- 核心：数据驱动创建对象 ---
                const nodes = knowledgePoints.map(kp => {
                    const geometry = new THREE.SphereGeometry(5, 32, 32); // 创建一个球体
                    const material = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
                    const sphere = new THREE.Mesh(geometry, material);
                    
                    // 将后端数据附加到3D对象上，方便后续交互
                    sphere.userData = { id: kp._id, title: kp.title, content: kp.content };

                    // 随机放置初始位置
                    sphere.position.set(
                        (Math.random() - 0.5) * 200,
                        (Math.random() - 0.5) * 200,
                        (Math.random() - 0.5) * 200
                    );
                    scene.add(sphere);
                    return sphere;
                });

                // --- 动画循环 ---
                const animate = () => {
                    requestAnimationFrame(animate);
                    // ...
                    renderer.render(scene, camera);
                };
                animate();

                // ... (清理函数)
            }, [knowledgePoints]); // 依赖于知识点数据

            return <div ref={mountRef} />;
        }
        ```
    *   **讲解：** “我们现在已经成功地将抽象的数据（知识点列表）映射为了具体的视觉元素（一堆随机分布的球体）。这是所有数据可视化的第一步。”

---

#### **第二部分：让宇宙“动”起来 - 力导向布局 (约90分钟)**

**教师讲解与带领编码：**

“现在星球是随机分布的，像一盘散沙。我们希望它们能像一个真实的星系一样，互相之间有引力和斥力，自动形成一个有组织的结构。我们将使用‘力导向图’算法来实现这个效果。”

1.  **力导向图简介**
    *   **讲解：** “想象一下，每个星球都带正电荷，所以它们互相排斥。同时，星球之间有一些看不见的‘引力绳’（代表知识点之间的关联）把它们拉近。在这些推力和拉力的共同作用下，整个系统最终会达到一个动态平衡的、有组织的状态。这就是力导向图。”

2.  **集成 `d3-force-3d`**
    *   **安装：**
        ```bash
        npm install d3-force-3d
        ```
    *   **讲解：** “`D3.js` 是数据可视化领域的王者。`d3-force-3d` 是它在3D领域的力模拟引擎，正好满足我们的需求。”

3.  **应用力导向布局**
    *   **修改 `KnowledgeUniversePage.jsx` 的 `useEffect`：**
        ```jsx
        // ... 在 `useEffect` 内部, 创建完 nodes 之后

        // --- 力导向模拟 ---
        // 1. 准备模拟所需的数据格式
        const forceData = knowledgePoints.map(kp => ({ id: kp._id }));

        // 2. 创建力模拟器
        const simulation = d3.forceSimulation(forceData, 3) // 告诉模拟器我们在3D空间
            .force('charge', d3.forceManyBody().strength(-30)) // 定义节点间的排斥力
            .force('center', d3.forceCenter(0, 0, 0)) // 定义一个向场景中心拉动的力
            .force('link', d3.forceLink([]).id(d => d.id).distance(50)); // 暂时没有连接线，但先定义好

        // 3. 在动画循环中更新节点位置
        const animate = () => {
            requestAnimationFrame(animate);

            // 更新力模拟
            simulation.tick();

            // 将模拟计算出的位置应用到Three.js的球体上
            forceData.forEach((d, i) => {
                const nodeMesh = nodes[i];
                nodeMesh.position.set(d.x, d.y, d.z);
            });

            // ... (控制器更新、渲染)
            renderer.render(scene, camera);
        };
        animate();
        ```
    *   **运行效果：** 学生会看到，原本随机分布的球体开始互相推挤，并围绕中心聚集，最终形成一个动态平衡的、类似星云的结构。

---

#### **第三部分：添加交互 - 鼠标拾取与信息展示 (约60分钟)**

**教师带领学生编码：**

“我们的宇宙活了，但还不能跟我们互动。接下来，我们要实现用鼠标点击一个‘星球’，就能看到它的详细信息。”

1.  **`Raycaster` (光线投射) 讲解**
    *   **讲解：** “在3D世界里，我们怎么知道鼠标点到了哪个物体？`Three.js` 提供了一个强大的工具 `Raycaster`。它会从相机的位置，沿着鼠标点击的方向，发射一道看不见的光线。这道光线碰到的第一个物体，就是我们选中的物体。”

2.  **实现鼠标点击事件**
    *   **在 `KnowledgeUniversePage.jsx` 中添加事件监听：**
        ```jsx
        // ... 在主 useEffect 中
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let selectedNode = null;

        function onMouseClick(event) {
            // 将鼠标点击位置转换为标准化设备坐标 (-1 to +1)
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

            // 通过相机和鼠标位置更新射线
            raycaster.setFromCamera(mouse, camera);

            // 计算射线相交的物体
            const intersects = raycaster.intersectObjects(nodes);

            if (intersects.length > 0) {
                const clickedObject = intersects[0].object;
                
                // 如果之前有选中的，恢复原来的颜色
                if (selectedNode) {
                    selectedNode.material.color.set(selectedNode.userData.originalColor);
                }

                // 高亮新选中的节点
                selectedNode = clickedObject;
                selectedNode.userData.originalColor = selectedNode.material.color.getHex();
                selectedNode.material.color.set(0xff0000); // 设置为红色

                // 显示信息 (可以用一个状态来控制UI显示)
                alert(`你点击了: ${clickedObject.userData.title}`);
            } else {
                // 点击空白区域，取消选中
                if (selectedNode) {
                    selectedNode.material.color.set(selectedNode.userData.originalColor);
                    selectedNode = null;
                }
            }
        }

        window.addEventListener('click', onMouseClick);

        // 在清理函数中移除事件监听
        return () => {
            // ...
            window.removeEventListener('click', onMouseClick);
        };
        ```

---

#### **四、 课堂总结与作业**

*   **总结：**
    *   “今天，我们实现了整个项目中最炫酷的功能之一！我们不再是简单地创建3D物体，而是将后端数据与前端视觉完美结合，用数据驱动的方式构建了一个动态的、可交互的3D知识宇宙。我们学习了力导向布局这个高级的可视化算法，并掌握了`Raycaster`这个核心的交互工具。这为大家打开了通往高级数据可视化领域的大门。”
*   **课后作业：**
    1.  **必须完成：** 确保你的知识宇宙可以成功加载数据，并能通过力导向图自动布局。确保鼠标点击可以高亮节点。
    2.  **交互优化（挑战）：**
        *   **目标：** 将 `alert` 替换为一个漂亮的UI浮层（Overlay），在页面角落显示当前选中节点的标题和内容摘要。
        *   **技术提示：** 在React组件中用一个`useState`来保存`selectedNodeData`，当选中节点时更新这个state，然后用JSX根据这个state来渲染UI。
    3.  **添加连接线（终极挑战）：**
        *   **目标：** 在节点之间绘制连接线（`Edge`），真正形成“图谱”。
        *   **技术提示：**
            1.  你需要定义节点间的关系。可以先简单地设定一个规则，比如“所有在24小时内创建的知识点互相连接”。
            2.  在后端的知识点API中，增加一个`related`字段，或者在前端动态生成关系数据 `links = [{source: id1, target: id2}, ...]`。
            3.  将 `links` 数据传入 `simulation.force('link').links(links)`。
            4.  在动画循环中，为每一条link创建一个`THREE.Line`对象，并根据`link.source`和`link.target`的位置来更新线的端点。
*   **预告下次课内容：**
    *   “我们的Web应用已经具备了AI、3D可视化等强大的功能。但是，它只能在浏览器里运行。下一次课，我们将进入课程的收官阶段——跨平台部署。我们将学习如何使用`Electron`，将我们这个复杂的Web应用，打包成一个可以在Windows或macOS上直接运行的桌面应用程序！”
