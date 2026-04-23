好的，这是为您的《大前端与AI实战》实训课程设计的第十三次课程的详细内容。这次课程将带领学生进入激动人心的3D世界，学习 `Three.js` 的基础知识，并将之前的知识图谱概念进行三维化升级。

---

### **《大前端与AI实战》第十三次课程：3D可视化入门与Three.js**

**课程主题：** 升维思考：用Three.js构建你的第一个3D知识宇宙
**总时长：** 4学时 (约3-3.5小时教学，半小时答疑与休息)

#### **一、 本次课程目标 (Objectives)**

在本次课程结束后，每位同学都应该能够：
1.  **理解** `Three.js` 的核心三要素：场景 (Scene)、相机 (Camera) 和渲染器 (Renderer)。
2.  **掌握** 在3D场景中创建基本物体所需的概念：几何体 (Geometry) 和材质 (Material)。
3.  **独立创建** 一个包含旋转立方体的基础 `Three.js` 场景。
4.  **添加** 轨道控制器 (`OrbitControls`)，实现通过鼠标缩放、平移和旋转3D场景。
5.  **将知识图谱数据** 映射到3D空间，将知识点表现为“星球”（球体），关系表现为“星际航线”（线条）。
6.  **（挑战目标）实现** 3D场景中的基本交互，如使用光线投射 (`Raycaster`) 实现鼠标拾取3D对象。

#### **二、 核心关键词 (Keywords)**

*   `Three.js`
*   场景 (Scene)
*   相机 (Camera) - `PerspectiveCamera`
*   渲染器 (Renderer) - `WebGLRenderer`
*   几何体 (Geometry) - `BoxGeometry`, `SphereGeometry`
*   材质 (Material) - `MeshBasicMaterial`, `MeshStandardMaterial`
*   网格 (Mesh)
*   光照 (Light) - `AmbientLight`, `PointLight`
*   轨道控制器 (`OrbitControls`)
*   光线投射 (`Raycaster`)

---

### **三、 详细教学流程 (Step-by-Step Guide)**

---

#### **第一部分：进入三维世界 - Three.js 核心概念 (约60分钟)**

**教师讲解，辅以`Mermaid`图和`LaTeX`公式：**

1.  **回顾与展望**
    *   “上节课，我们用 G6 在二维平面上绘制了知识图谱。今天，我们要打破次元壁，进入三维空间！我们将使用 `Three.js`——目前最流行、最强大的Web 3D图形库，把我们的知识网络变成一个可以自由探索的‘知识宇宙’。”

2.  **Three.js 的世界观：三大核心**
    *   **讲解：** “要构建一个3D世界，你只需要记住三个最基本的东西，就像拍电影一样。”

    ```mermaid
    graph TD
        subgraph 3D世界
            A[场景 Scene] -- 包含 --> C{物体 Mesh};
            A -- 包含 --> D[光照 Light];
            B[相机 Camera] -- 拍摄 --> A;
            E[渲染器 Renderer] -- 渲染 --> B;
        end
        E -- 输出到 --> F[屏幕 Canvas];
    ```

    *   **场景 (Scene):** “这是你的‘舞台’，所有你要展示的3D物体、光源、相机都放在这里面。”
    *   **相机 (Camera):** “这是你的‘眼睛’或‘摄影机’，决定了你从哪个角度、用什么样的视野去观察这个舞台。我们最常用的是**透视相机 (`PerspectiveCamera`)**，它模拟人眼的视觉效果，有‘近大远小’的特点。”
    *   **渲染器 (Renderer):** “这是你的‘放映机’。它会根据相机拍到的景象，把它计算并绘制成2D图像，最终显示在我们的网页上。”

3.  **创造万物：几何体与材质**
    *   **讲解：** “舞台搭好了，怎么在上面放东西呢？一个可见的3D物体，我们称之为**网格 (Mesh)**，它由两部分组成：”
        *   **几何体 (Geometry):** 定义了物体的**形状**。比如，一个立方体、一个球体、一个圆锥体。它由大量的顶点（Vertices）和面（Faces）构成。
        *   **材质 (Material):** 定义了物体的**外观**。比如，它的颜色、是光滑还是粗糙、是金属还是塑料、是否反光等。
    *   **公式表达：** 我们可以这样理解一个3D物体的诞生：
        $Object_{3D} = \text{Mesh}(\text{Geometry}, \text{Material})$

4.  **点亮世界：光照 (Light)**
    *   **讲解：** “如果我们使用像`MeshBasicMaterial`这样不反光的材质，物体自己就会发光。但如果我们想模拟真实世界，使用更高级的材质如`MeshStandardMaterial`，那么场景中就必须有光，否则物体就是一片漆黑。”
    *   **常用光源：**
        *   **环境光 (`AmbientLight`):** 提供一个基础的、无方向的光照，让场景中的物体不会有纯黑的暗部。
        *   **点光源 (`PointLight`):** 像一个灯泡，从一个点向所有方向发光，会产生阴影。

---

#### **第二部分：Hello, 3D World! - 你的第一个旋转立方体 (约75分钟)**

**教师带领学生前端编码：**

1.  **安装 Three.js**
    *   在前端项目 (`feynman-platform-frontend`) 终端中安装：
        ```bash
        npm install three
        ```

2.  **创建3D场景页面组件**
    *   在 `src/pages` 下新建 `ThreeJSPage.jsx`。
    *   **编写 `ThreeJSPage.jsx`：**
        ```jsx
        // src/pages/ThreeJSPage.jsx
        import { useEffect, useRef } from 'react';
        import * as THREE from 'three';
        import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

        function ThreeJSPage() {
            const mountRef = useRef(null);

            useEffect(() => {
                const currentMount = mountRef.current;

                // 1. 创建场景 (Scene)
                const scene = new THREE.Scene();
                scene.background = new THREE.Color(0x1a2a3a); // 设置背景色

                // 2. 创建相机 (Camera)
                const camera = new THREE.PerspectiveCamera(
                    75, // 视野角度 (Field of View)
                    currentMount.clientWidth / currentMount.clientHeight, // 宽高比
                    0.1, // 近截面
                    1000 // 远截面
                );
                camera.position.z = 5; // 将相机向后移，以便能看到物体

                // 3. 创建渲染器 (Renderer)
                const renderer = new THREE.WebGLRenderer({ antialias: true }); // antialias抗锯齿
                renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
                currentMount.appendChild(renderer.domElement);

                // 4. 创建物体 (几何体 + 材质 -> 网格)
                const geometry = new THREE.BoxGeometry(1, 1, 1); // 1x1x1的立方体
                const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // 绿色基础材质
                const cube = new THREE.Mesh(geometry, material);
                scene.add(cube); // 将立方体添加到场景中

                // 5. 添加轨道控制器 (OrbitControls)
                const controls = new OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true; // 启用阻尼效果，使旋转更平滑

                // 6. 创建动画循环 (Animation Loop)
                const animate = () => {
                    requestAnimationFrame(animate); // 请求下一帧

                    // 使立方体旋转
                    cube.rotation.x += 0.01;
                    cube.rotation.y += 0.01;

                    controls.update(); // 更新控制器
                    renderer.render(scene, camera); // 渲染场景
                };

                animate();
                
                // 7. 处理窗口大小变化
                const handleResize = () => {
                    camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
                    camera.updateProjectionMatrix();
                    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
                };
                window.addEventListener('resize', handleResize);

                // 8. 组件卸载时清理资源
                return () => {
                    window.removeEventListener('resize', handleResize);
                    currentMount.removeChild(renderer.domElement);
                };
            }, []);

            return <div ref={mountRef} style={{ width: '100%', height: '80vh' }} />;
        }
        export default ThreeJSPage;
        ```
    *   **添加路由和入口：**
        *   在 `App.jsx` 中添加路由：`<Route path="/3d-world" element={<ThreeJSPage />} />`
        *   在导航栏 `Layout.jsx` 中添加链接 “3D视界”。

3.  **测试与交互**
    *   导航到“3D视界”页面，你应该能看到一个绿色的、正在旋转的立方体。
    *   **用鼠标操作：**
        *   **左键拖拽：** 旋转视角。
        *   **滚轮滚动：** 缩放。
        *   **右键拖拽：** 平移。

---

#### **第三部分：构建3D知识宇宙 (约75分钟)**

**教师带领学生编码：**

“立方体很有趣，但现在我们要用 `Three.js` 来做正事了——把我们的知识图谱数据渲染成一个3D网络。”

1.  **改造 `ThreeJSPage.jsx` 以接收和处理图谱数据**
    *   **获取数据：** 使用 `useEffect` 和 `apiClient` 去获取 `GET /api/graph/knowledge-map` 的数据。
    *   **修改代码：**
        ```jsx
        // 在 ThreeJSPage.jsx 中
        import { useState } from 'react'; // 引入useState
        import apiClient from '../api/axios'; // 引入apiClient

        // ...
        function ThreeJSPage() {
            const mountRef = useRef(null);
            const [graphData, setGraphData] = useState({ nodes: [], edges: [] });

            // 获取图谱数据
            useEffect(() => {
                apiClient.get('/graph/knowledge-map')
                    .then(response => setGraphData(response.data))
                    .catch(error => console.error(error));
            }, []);

            // Three.js 的主 useEffect，依赖 graphData
            useEffect(() => {
                if (graphData.nodes.length === 0) return;

                const currentMount = mountRef.current;
                // ... (场景、相机、渲染器、控制器、动画循环、清理等代码基本不变)

                // --- 核心改造部分：根据数据创建物体 ---
                
                // 存储节点对象，方便后续连线
                const nodeObjects = new Map();

                // 1. 创建节点 (星球)
                const sphereGeometry = new THREE.SphereGeometry(0.2, 32, 32); // 半径为0.2的球体
                graphData.nodes.forEach(node => {
                    const nodeMaterial = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
                    const sphere = new THREE.Mesh(sphereGeometry, nodeMaterial);
                    
                    // 随机放置在空间中
                    sphere.position.set(
                        (Math.random() - 0.5) * 10,
                        (Math.random() - 0.5) * 10,
                        (Math.random() - 0.5) * 10
                    );
                    
                    sphere.userData = { id: node.id, label: node.label }; // 存储元数据
                    scene.add(sphere);
                    nodeObjects.set(node.id, sphere);
                });

                // 2. 创建边 (星际航线)
                const lineMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.5 });
                graphData.edges.forEach(edge => {
                    const sourceNode = nodeObjects.get(edge.source);
                    const targetNode = nodeObjects.get(edge.target);
                    if (sourceNode && targetNode) {
                        const points = [sourceNode.position, targetNode.position];
                        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
                        const line = new THREE.Line(lineGeometry, lineMaterial);
                        scene.add(line);
                    }
                });

                // 3. 添加光照
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
                scene.add(ambientLight);
                const pointLight = new THREE.PointLight(0xffffff, 1);
                pointLight.position.set(5, 5, 5);
                scene.add(pointLight);

                // ... (动画循环等代码)
                // 在动画循环中可以移除之前的 cube.rotation 代码

            }, [graphData]); // 依赖图谱数据

            return <div ref={mountRef} style={{ width: '100%', height: '80vh' }} />;
        }
        ```

---

#### **四、 课堂总结与作业**

*   **总结：**
    *   “今天是一次令人兴奋的‘升维’之旅！我们掌握了 `Three.js` 的核心概念，从零开始搭建了一个属于自己的3D世界。更重要的是，我们成功地将抽象的知识图谱数据映射到了三维空间，创造出了一个由‘知识星球’和‘星际航线’组成的、可以自由探索的宇宙。这不仅是技术的炫技，更是一种全新的数据认知方式。”
*   **课后作业：**
    1.  **必须完成：** 确保3D知识图谱能够成功渲染，并且可以通过鼠标进行交互（旋转、缩放）。
    2.  **交互增强（挑战）：**
        *   **目标：** 实现当鼠标悬停在一个“星球”上时，该星球和与之相连的“航线”会高亮。
        *   **技术提示：**
            1.  在 `animate` 循环中，使用 `THREE.Raycaster` 来检测鼠标是否与场景中的物体相交。
            2.  `Raycaster` 需要一个归一化的鼠标坐标（`mouse.x` 和 `mouse.y`，范围在-1到1之间）。你需要添加 `mousemove` 事件监听器来获取鼠标位置并进行转换。
                *   转换公式：$mouse.x = (\frac{event.clientX}{width}) \times 2 - 1$, $mouse.y = -(\frac{event.clientY}{height}) \times 2 + 1$
            3.  如果 `raycaster.intersectObjects(scene.children)` 检测到了相交的物体，改变该物体的材质颜色（比如 `material.emissive.setHex(0xff0000)`），然后再在鼠标移开时恢复原状。
*   **预告下次课内容：**
    *   “我们的3D宇宙已经初具雏形，但它还漂浮在虚空中。如果能把它放在一个更宏大、更真实的背景——比如整个地球上呢？下一次课，我们将学习另一个强大的3D地理信息库 `CesiumJS`，学习如何创建一个数字孪生地球，并将我们的知识点‘钉’在地球的任意位置上。”