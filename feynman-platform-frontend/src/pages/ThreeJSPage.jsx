// src/pages/ThreeJSPage.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import DOMPurify from 'dompurify';
import apiClient from '../api/axios';
import './ThreeJSPage.css';

function ThreeJSPage() {
    const navigate = useNavigate();
    const mountRef = useRef(null);
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });
    const [knowledgePoints, setKnowledgePoints] = useState([]); // 存储完整知识点数据
    const [showEdges, setShowEdges] = useState(false); // 控制连接线显示状态
    const [hoveredNodeData, setHoveredNodeData] = useState(null); // 悬停的节点数据
    const [selectedNodeData, setSelectedNodeData] = useState(null); // 选中的节点数据
    const [editingTags, setEditingTags] = useState(false); // 是否正在编辑标签
    const [newTag, setNewTag] = useState(''); // 新标签输入
    const [searchQuery, setSearchQuery] = useState(''); // 搜索关键词
    const [filteredNodeIds, setFilteredNodeIds] = useState(new Set()); // 筛选后的节点ID
    
    const nodeObjectsRef = useRef(new Map()); // 节点对象映射表
    const edgesByNodeIdRef = useRef(new Map()); // 边关联关系映射表: nodeId => [Line1, Line2, ...]
    const edgeLinesRef = useRef([]); // 存储所有边线对象
    const edgeConnectionsRef = useRef(new Map()); // 边连接关系: nodeId => [connectedNodeId1, connectedNodeId2, ...]
    const raycasterRef = useRef(new THREE.Raycaster()); // 射线投射器
    const mouseRef = useRef(new THREE.Vector2()); // 归一化鼠标坐标
    const hoveredObjectRef = useRef(null); // 当前悬停对象
    const hoveredNodesRef = useRef(new Set()); // 当前高亮的节点集合
    const hoveredEdgesRef = useRef(new Set()); // 当前高亮的边集合
    const sceneRef = useRef(null); // 场景引用
    
    // 搜索状态用useRef存储，避免触发3D场景重建
    const searchQueryRef = useRef('');
    const filteredNodeIdsRef = useRef(new Set());

    // 获取知识点数据
    useEffect(() => {
        const fetchGraphData = async () => {
            try {
                const response = await apiClient.get('/knowledge-points');
                // 兼容新格式：{ knowledgePoints, relations } 和旧格式：[...]
                const data = response.data;
                const kps = Array.isArray(data) ? data : (Array.isArray(data?.knowledgePoints) ? data.knowledgePoints : []);
                
                // 保存完整知识点数据
                setKnowledgePoints(kps);
                
                // 转换为图谱格式
                const nodes = kps.map(kp => ({
                    id: kp._id,
                    name: kp.title,
                    tags: kp.tags || [], // 保留标签信息
                    content: kp.content || '', // 保存内容
                    category: kp.category || ''
                }));
                setGraphData({ nodes, links: [] });
            } catch (error) {
                console.error('获取知识点数据失败:', error);
            }
        };

        fetchGraphData();
    }, []);
    
    // 搜索筛选逻辑 - 同时更新state和ref
    useEffect(() => {
        // 同步到ref（用于动画循环读取）
        searchQueryRef.current = searchQuery;
        
        if (!searchQuery.trim()) {
            const emptySet = new Set();
            setFilteredNodeIds(emptySet);
            filteredNodeIdsRef.current = emptySet;
            return;
        }
        
        const query = searchQuery.toLowerCase();
        const matchedIds = new Set();
        
        knowledgePoints.forEach(kp => {
            if (kp.title && kp.title.toLowerCase().includes(query)) {
                matchedIds.add(kp._id);
                return;
            }
            if (kp.content && kp.content.toLowerCase().includes(query)) {
                matchedIds.add(kp._id);
                return;
            }
            if (kp.tags && kp.tags.some(tag => tag.toLowerCase().includes(query))) {
                matchedIds.add(kp._id);
                return;
            }
            if (kp.category && kp.category.toLowerCase().includes(query)) {
                matchedIds.add(kp._id);
            }
        });
        
        setFilteredNodeIds(matchedIds);
        filteredNodeIdsRef.current = matchedIds; // 同步到ref
    }, [searchQuery, knowledgePoints]);
    
    // 保存标签修改
    const handleSaveTags = async (nodeId, newTags) => {
        try {
            await apiClient.put(`/knowledge-points/${nodeId}`, {
                tags: newTags
            });
            
            // 更新本地数据
            setKnowledgePoints(prev => prev.map(kp => 
                kp._id === nodeId ? { ...kp, tags: newTags } : kp
            ));
            
            // 更新选中节点数据
            if (selectedNodeData && selectedNodeData._id === nodeId) {
                setSelectedNodeData({ ...selectedNodeData, tags: newTags });
            }
            
            // 重新加载图谱数据以更新连接线
            const response = await apiClient.get('/knowledge-points');
            const data = response.data;
            const kps = Array.isArray(data) ? data : (Array.isArray(data?.knowledgePoints) ? data.knowledgePoints : []);
            setKnowledgePoints(kps);
            
            const nodes = kps.map(kp => ({
                id: kp._id,
                name: kp.title,
                tags: kp.tags || [],
                content: kp.content || '',
                category: kp.category || ''
            }));
            setGraphData({ nodes, links: [] });
            
            console.log('标签更新成功');
        } catch (error) {
            console.error('保存标签失败:', error);
            alert('保存标签失败，请重试');
        }
    };
    
    // 添加标签
    const handleAddTag = () => {
        if (!newTag.trim()) return;
        
        const currentTags = selectedNodeData.tags || [];
        if (currentTags.includes(newTag.trim())) {
            alert('标签已存在');
            return;
        }
        
        const updatedTags = [...currentTags, newTag.trim()];
        handleSaveTags(selectedNodeData._id, updatedTags);
        setNewTag('');
    };
    
    // 删除标签
    const handleRemoveTag = (tagToRemove) => {
        const currentTags = selectedNodeData.tags || [];
        const updatedTags = currentTags.filter(tag => tag !== tagToRemove);
        handleSaveTags(selectedNodeData._id, updatedTags);
    };

    useEffect(() => {
        // 等待图谱数据加载完成
        if (graphData.nodes.length === 0) return;

        const currentMount = mountRef.current;
        if (!currentMount) return;

        // 辅助函数：Fibonacci球形分布算法（均匀分布在球面上）
        const getSpherePosition = (index, total, radius = 6) => {
            // 黄金角度
            const phi = Math.PI * (3 - Math.sqrt(5)); // 约 2.39996
            
            // y坐标从1到-1均匀分布
            const y = 1 - (index / (total - 1)) * 2;
            
            // 当前高度的半径
            const radiusAtY = Math.sqrt(1 - y * y);
            
            // 绕Y轴的角度
            const theta = phi * index;
            
            // 转换为笛卡尔坐标
            const x = Math.cos(theta) * radiusAtY;
            const z = Math.sin(theta) * radiusAtY;
            
            // 添加少量随机偏移，让分布更自然
            const jitter = 0.3;
            return new THREE.Vector3(
                x * radius + (Math.random() - 0.5) * jitter,
                y * radius + (Math.random() - 0.5) * jitter,
                z * radius + (Math.random() - 0.5) * jitter
            );
        };
        
        // 辅助函数：生成星球纹理
        const createPlanetTexture = (baseColor) => {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const context = canvas.getContext('2d');
            
            // 基础颜色
            const r = (baseColor >> 16) & 255;
            const g = (baseColor >> 8) & 255;
            const b = baseColor & 255;
            
            // 绘制背景渐变
            const gradient = context.createRadialGradient(256, 256, 0, 256, 256, 256);
            gradient.addColorStop(0, `rgba(${r + 50}, ${g + 50}, ${b + 50}, 1)`);
            gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 1)`);
            gradient.addColorStop(1, `rgba(${Math.max(0, r - 50)}, ${Math.max(0, g - 50)}, ${Math.max(0, b - 50)}, 1)`);
            context.fillStyle = gradient;
            context.fillRect(0, 0, 512, 512);
            
            // 添加表面纹理（模拟地形）
            context.globalAlpha = 0.3;
            for (let i = 0; i < 100; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const radius = Math.random() * 30 + 10;
                const darkness = Math.random() * 0.5;
                
                context.fillStyle = `rgba(0, 0, 0, ${darkness})`;
                context.beginPath();
                context.arc(x, y, radius, 0, Math.PI * 2);
                context.fill();
            }
            
            // 添加云层效果
            context.globalAlpha = 0.2;
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const radius = Math.random() * 40 + 20;
                
                context.fillStyle = 'rgba(255, 255, 255, 0.3)';
                context.beginPath();
                context.arc(x, y, radius, 0, Math.PI * 2);
                context.fill();
            }
            
            // 添加噪点（细节）
            context.globalAlpha = 0.15;
            for (let i = 0; i < 2000; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const size = Math.random() * 2;
                const brightness = Math.random();
                
                context.fillStyle = brightness > 0.5 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)';
                context.fillRect(x, y, size, size);
            }
            
            return new THREE.CanvasTexture(canvas);
        };

        // 1. 创建场景 (Scene)
        const scene = new THREE.Scene();
        sceneRef.current = scene; // 保存场景引用

        // 使用与知识宇宙相同的背景色
        scene.background = new THREE.Color(0x000511);

        // 添加星空背景（与知识宇宙相同）
        const createStars = () => {
            const geometry = new THREE.BufferGeometry();
            const count = 10000;
            const positions = new Float32Array(count * 3);

            for (let i = 0; i < count * 3; i++) {
                positions[i] = (Math.random() - 0.5) * 1500;
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const material = new THREE.PointsMaterial({
                color: 0xffffff,
                size: 2,
                transparent: true,
                opacity: 0.8
            });

            return new THREE.Points(geometry, material);
        };

        scene.add(createStars());

        // 2. 创建相机 (Camera)
        const camera = new THREE.PerspectiveCamera(
            75, // 视野角度 (Field of View)
            currentMount.clientWidth / currentMount.clientHeight, // 宽高比
            0.1, // 近截面
            1000 // 远截面
        );
        camera.position.z = 22; // 调远相机，确保能看到完整的大球

        // 3. 创建渲染器 (Renderer)
        const renderer = new THREE.WebGLRenderer({ antialias: true }); // antialias抗锯齿
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
        currentMount.appendChild(renderer.domElement);

        // 4. 渲染知识点节点为 3D 球体（Soul风格）
        nodeObjectsRef.current.clear(); // 清空之前的映射

        // Soul风格明亮柔和色调
        const planetColors = [
            0xf5e6d3, // 暖白色
            0xe0f0f0, // 冰蓝色
            0xf0e0d0, // 奶油色
            0xd0e8d8, // 淡绿色
            0xf0d0d8, // 淡粉色
            0xf8f0c0, // 柠檬黄
            0xd8e8e8, // 淡青色
            0xe8d0d0, // 珊瑩粉
            0xc8e0d8, // 薄荷绿
            0xf0e8d8  // 香草白
        ];
        
        graphData.nodes.forEach((node, index) => {
            // 使用柔和颜色
            const color = planetColors[index % planetColors.length];
            
            // 随机大小（Soul风格的关键）
            const size = 0.4 + Math.random() * 0.6; // 0.4 ~ 1.0
            const sphereGeometry = new THREE.SphereGeometry(size, 32, 32);
            
            // 简洁柔和的材质（无纹理，更亮）
            const nodeMaterial = new THREE.MeshStandardMaterial({ 
                color: color,
                roughness: 0.7,
                metalness: 0.1,
                emissive: color,
                emissiveIntensity: 0.3  // 提高发光强度
            });
            
            // 创建球体网格
            const sphere = new THREE.Mesh(sphereGeometry, nodeMaterial);
            
            // 使用Fibonacci球形分布（更大半径，更松散）
            const position = getSpherePosition(index, graphData.nodes.length, 8);
            sphere.position.copy(position);
            
            // 存储元数据（包括原始发光颜色、标签和动画参数）
            sphere.userData = { 
                id: node.id, 
                label: node.name,
                tags: node.tags || [],                        // 保存标签信息
                originalEmissive: color,
                // Soul风格动画参数
                floatPhase: Math.random() * Math.PI * 2,      // 漂浮相位（随机起始）
                floatSpeed: 0.3 + Math.random() * 0.4,        // 漂浮速度
                floatAmplitude: 0.15 + Math.random() * 0.1,   // 漂浮幅度
                rotationSpeed: 0.002 + Math.random() * 0.003, // 自转速度
                originalY: position.y                          // 原始Y坐标
            };
            
            // 添加到场景
            scene.add(sphere);
            
            // 创建文字标签（放大字体）
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 512;
            canvas.height = 128;
            
            // 透明背景
            context.clearRect(0, 0, canvas.width, canvas.height);
            
            // 放大字体 + 更明显的阴影
            context.font = 'bold 42px Microsoft YaHei, Arial';
            context.fillStyle = 'rgba(255, 255, 255, 1)';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.shadowColor = 'rgba(0, 0, 0, 0.8)';
            context.shadowBlur = 6;
            context.fillText(node.name, 256, 64);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true,
                depthTest: false // 始终显示在最前面
            });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.copy(position);
            sprite.position.y += size + 0.5; // 根据球体大小调整
            sprite.scale.set(4, 1, 1); // 放大标签
            scene.add(sprite);
            
            // 关联标签到球体
            sphere.userData.labelSprite = sprite;
            
            // 存入映射表
            nodeObjectsRef.current.set(node.id, sphere);
        });

        // 5. 创建边（星际航线）- 根据标签相同连线
        edgesByNodeIdRef.current.clear();
        edgeLinesRef.current = []; // 清空之前的边线
        
        // 使用虚线材质创建星际射线效果
        const lineMaterial = new THREE.LineDashedMaterial({ 
            color: 0xaaaaaa, // 灰色
            transparent: true, 
            opacity: 0.6,       // 略微提高透明度
            dashSize: 0.5,      // 虚线段长度（更长）
            gapSize: 0.3,       // 虚线间隔
            linewidth: 2        // 线宽（更粗）
        });
        
        // 辅助函数：检查两个节点是否有相同标签
        const hasCommonTag = (node1, node2) => {
            if (!node1.tags || !node2.tags) return false;
            if (node1.tags.length === 0 || node2.tags.length === 0) return false;
            return node1.tags.some(tag => node2.tags.includes(tag));
        };
        
        // 遍历所有节点对，如果有相同标签就连线
        const nodes = graphData.nodes;
        let connectionCount = 0;
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                if (hasCommonTag(nodes[i], nodes[j])) {
                    connectionCount++;
                    const sourceNode = nodeObjectsRef.current.get(nodes[i].id);
                    const targetNode = nodeObjectsRef.current.get(nodes[j].id);
                    
                    if (sourceNode && targetNode) {
                        const points = [sourceNode.position, targetNode.position];
                        const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
                        const line = new THREE.Line(lineGeometry, lineMaterial.clone()); // 克隆材质以便独立控制
                        
                        // 计算线段距离（虚线效果必需）
                        line.computeLineDistances();
                        
                        // 初始状态根据 showEdges 决定可见性
                        line.visible = showEdges;
                        
                        scene.add(line);
                        edgeLinesRef.current.push(line);
                        
                        // 记录每个节点关联的边
                        if (!edgesByNodeIdRef.current.has(nodes[i].id)) {
                            edgesByNodeIdRef.current.set(nodes[i].id, []);
                        }
                        if (!edgesByNodeIdRef.current.has(nodes[j].id)) {
                            edgesByNodeIdRef.current.set(nodes[j].id, []);
                        }
                        edgesByNodeIdRef.current.get(nodes[i].id).push(line);
                        edgesByNodeIdRef.current.get(nodes[j].id).push(line);
                        
                        // 记录节点间的连接关系
                        if (!edgeConnectionsRef.current.has(nodes[i].id)) {
                            edgeConnectionsRef.current.set(nodes[i].id, []);
                        }
                        if (!edgeConnectionsRef.current.has(nodes[j].id)) {
                            edgeConnectionsRef.current.set(nodes[j].id, []);
                        }
                        edgeConnectionsRef.current.get(nodes[i].id).push(nodes[j].id);
                        edgeConnectionsRef.current.get(nodes[j].id).push(nodes[i].id);
                    }
                }
            }
        }
        console.log(`根据标签生成了 ${connectionCount} 条连接线`);

        // 6. 添加光照系统（营造太空氛围）
        const ambientLight = new THREE.AmbientLight(0x404040, 1); // 较弱的环境光
        scene.add(ambientLight);
        
        // 主光源（模拟太阳）
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        sunLight.position.set(10, 10, 10);
        scene.add(sunLight);
        
        // 辅助光源（冷蓝色调）
        const pointLight = new THREE.PointLight(0x5599ff, 0.8);
        pointLight.position.set(-10, 5, -10);
        scene.add(pointLight);
        
        // 第三个光源（淡蓝色，营造深度）
        const backLight = new THREE.PointLight(0x88ccff, 0.5);
        backLight.position.set(0, -10, 0);
        scene.add(backLight);

        // 7. 添加轨道控制器 (OrbitControls)
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; // 启用阻尼效果，使旋转更平滑

        // 8. 鼠标坐标归一化函数
        const handleMouseMove = (event) => {
            const rect = currentMount.getBoundingClientRect();
            mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        };
        currentMount.addEventListener('mousemove', handleMouseMove);
        
        // 鼠标点击事件处理
        const handleClick = (event) => {
            const rect = currentMount.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            raycasterRef.current.setFromCamera(mouse, camera);
            const spheres = scene.children.filter(
                obj => obj.type === 'Mesh' && obj.geometry.type === 'SphereGeometry'
            );
            
            const intersects = raycasterRef.current.intersectObjects(spheres);
            
            if (intersects.length > 0) {
                const clickedObject = intersects[0].object;
                const nodeId = clickedObject.userData.id;
                
                // 查找完整的知识点数据
                const kp = knowledgePoints.find(k => k._id === nodeId);
                if (kp) {
                    setSelectedNodeData(kp);
                }
            } else {
                // 点击空白处取消选中
                setSelectedNodeData(null);
            }
        };
        currentMount.addEventListener('click', handleClick);

        // 9. 节点高亮函数（只高亮有共同标签的节点和连线，不暗化其他）
        const highlightNode = (mesh) => {
            if (!mesh) return;
            
            const nodeId = mesh.userData.id;
            const connectedNodeIds = edgeConnectionsRef.current.get(nodeId) || [];
            const connectedEdges = edgesByNodeIdRef.current.get(nodeId) || [];
            
            // 1. 高亮当前节点（白色发光，最亮）
            mesh.material.emissive.setHex(0xffffff);
            mesh.material.emissiveIntensity = 1.0;
            hoveredNodesRef.current.add(nodeId);
            
            // 2. 高亮相连的节点（淡黄色发光）
            connectedNodeIds.forEach(connectedNodeId => {
                const connectedNode = nodeObjectsRef.current.get(connectedNodeId);
                if (connectedNode) {
                    connectedNode.material.emissive.setHex(0xffffaa);
                    connectedNode.material.emissiveIntensity = 0.7;
                    hoveredNodesRef.current.add(connectedNodeId);
                }
            });
            
            // 3. 高亮相连的边（黄色，完全不透明，加速流动）
            connectedEdges.forEach(edge => {
                edge.material.opacity = 1.0;
                edge.material.color.setHex(0xffff00);
                edge.material.dashSize = 0.8;  // 高亮时虚线更长
                edge.material.gapSize = 0.2;   // 间隔更小
                edge.userData.isHighlighted = true; // 标记为高亮状态
                hoveredEdgesRef.current.add(edge);
            });
        };

        const resetHighlight = () => {
            // 恢复被高亮的节点
            hoveredNodesRef.current.forEach(nodeId => {
                const node = nodeObjectsRef.current.get(nodeId);
                if (node && node.userData.originalEmissive) {
                    node.material.emissive.setHex(node.userData.originalEmissive);
                    node.material.emissiveIntensity = 0.3;
                }
            });
            hoveredNodesRef.current.clear();
            
            // 恢复被高亮的边
            hoveredEdgesRef.current.forEach(edge => {
                edge.material.opacity = 0.6;
                edge.material.color.setHex(0xaaaaaa);
                edge.material.dashSize = 0.5;   // 恢复虚线参数
                edge.material.gapSize = 0.3;
                edge.userData.isHighlighted = false; // 清除高亮标记
            });
            hoveredEdgesRef.current.clear();
        };

        // 10. 创建动画循环 (Animation Loop)
        let clock = new THREE.Clock();
        
        const animate = () => {
            requestAnimationFrame(animate); // 请求下一帧
            
            const elapsedTime = clock.getElapsedTime();

            controls.update(); // 更新控制器
            
            // ===== Soul风格动态效果 =====
            // 遍历所有球体，更新自转和漂浮
            nodeObjectsRef.current.forEach((sphere) => {
                const { floatPhase, floatSpeed, floatAmplitude, rotationSpeed, originalY, labelSprite } = sphere.userData;
                
                // 1. 球体自转
                sphere.rotation.y += rotationSpeed;
                
                // 2. 上下漂浮效果（正弦波）
                const floatOffset = Math.sin(elapsedTime * floatSpeed + floatPhase) * floatAmplitude;
                sphere.position.y = originalY + floatOffset;
                
                // 3. 同步更新标签位置
                if (labelSprite) {
                    labelSprite.position.y = sphere.position.y + 1.3;
                }
            });
            
            // 4. 整体缓慢旋转（非常慢）
            scene.rotation.y += 0.0008; // 非常缓慢的旋转
            
            // 搜索筛选效果 - 从 ref 读取搜索状态
            const currentSearchQuery = searchQueryRef.current;
            const currentFilteredIds = filteredNodeIdsRef.current;
            
            nodeObjectsRef.current.forEach((sphere, nodeId) => {
                const isFiltered = currentSearchQuery && !currentFilteredIds.has(nodeId);
                const isMatched = currentSearchQuery && currentFilteredIds.has(nodeId);
                
                let targetOpacity = 1.0;
                let targetScale = 1.0;
                let targetEmissiveInt = 0.3;
                let targetEmissiveColor = sphere.userData.originalEmissive;
                
                if (isFiltered) {
                    // 未匹配：变暗、变小、几乎不可见
                    targetOpacity = 0.08;
                    targetScale = 0.3;
                    targetEmissiveInt = 0.02;
                } else if (isMatched) {
                    // 匹配：大幅放大 + 金色高亮发光 + 脉冲效果
                    targetScale = 2.5;
                    targetEmissiveInt = 1.5 + Math.sin(elapsedTime * 3) * 0.5; // 脉冲效果
                    targetEmissiveColor = 0x00ffff; // 青色高亮
                    sphere.material.emissive.setHex(targetEmissiveColor);
                }
                
                sphere.material.opacity += (targetOpacity - sphere.material.opacity) * 0.15;
                sphere.material.transparent = true;
                
                const currentScale = sphere.scale.x;
                const newScale = currentScale + (targetScale - currentScale) * 0.12;
                sphere.scale.setScalar(newScale);
                
                sphere.material.emissiveIntensity += (targetEmissiveInt - sphere.material.emissiveIntensity) * 0.15;
                
                // 标签效果
                if (sphere.userData.labelSprite) {
                    if (isMatched) {
                        // 匹配的标签完全显示且放大
                        sphere.userData.labelSprite.material.opacity = 1;
                        sphere.userData.labelSprite.scale.set(6, 1.5, 1);
                    } else if (isFiltered) {
                        // 未匹配的标签几乎不可见
                        sphere.userData.labelSprite.material.opacity = 0.05;
                        sphere.userData.labelSprite.scale.set(4, 1, 1);
                    } else {
                        // 默认状态
                        sphere.userData.labelSprite.material.opacity = 1;
                        sphere.userData.labelSprite.scale.set(4, 1, 1);
                    }
                }
                
                // 恢复原始颜色（无搜索时）
                if (!currentSearchQuery && sphere.userData.originalEmissive) {
                    sphere.material.emissive.setHex(sphere.userData.originalEmissive);
                }
            });
            
            if (currentSearchQuery && currentFilteredIds.size > 0) {
                edgeLinesRef.current.forEach(line => {
                    let isRelevant = false;
                    nodeObjectsRef.current.forEach((sphere, nodeId) => {
                        const edges = edgesByNodeIdRef.current.get(nodeId) || [];
                        if (edges.includes(line) && currentFilteredIds.has(nodeId)) {
                            isRelevant = true;
                        }
                    });
                    const targetOpacity = isRelevant ? 0.8 : 0.1;
                    line.material.opacity += (targetOpacity - line.material.opacity) * 0.1;
                });
            } else {
                edgeLinesRef.current.forEach(line => {
                    line.material.opacity += (0.6 - line.material.opacity) * 0.1;
                });
            }
            
            // 5. 连线星际射线效果（流动动画）
            edgeLinesRef.current.forEach(line => {
                if (line.material.dashSize !== undefined) {
                    // 高亮时加速流动，正常时缓慢流动
                    const speed = line.userData.isHighlighted ? 0.08 : 0.02;
                    line.material.dashOffset -= speed;
                }
            });

            // 射线检测：鼠标悬停高亮
            raycasterRef.current.setFromCamera(mouseRef.current, camera);
            
            // 筛选场景中的球体对象
            const spheres = scene.children.filter(
                obj => obj.type === 'Mesh' && obj.geometry.type === 'SphereGeometry'
            );
            
            // 检测相交
            const intersects = raycasterRef.current.intersectObjects(spheres);
            
            if (intersects.length > 0) {
                // 取最近的相交对象
                const hoveredObject = intersects[0].object;
                
                if (hoveredObject !== hoveredObjectRef.current) {
                    // 恢复之前的高亮
                    resetHighlight();
                    // 高亮新对象
                    highlightNode(hoveredObject);
                    // 更新当前悬停对象
                    hoveredObjectRef.current = hoveredObject;
                    
                    // 显示悬停卡片
                    const nodeId = hoveredObject.userData.id;
                    const kp = knowledgePoints.find(k => k._id === nodeId);
                    if (kp) {
                        setHoveredNodeData(kp);
                    }
                }
            } else {
                // 没有相交，恢复之前的高亮
                if (hoveredObjectRef.current) {
                    resetHighlight();
                    hoveredObjectRef.current = null;
                    setHoveredNodeData(null);
                }
            }

            renderer.render(scene, camera); // 渲染场景
        };

        animate();

        // 11. 处理窗口大小变化
        const handleResize = () => {
            camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
        };
        window.addEventListener('resize', handleResize);

        // 12. 组件卸载时清理资源
        return () => {
            window.removeEventListener('resize', handleResize);
            currentMount.removeEventListener('mousemove', handleMouseMove);
            currentMount.removeEventListener('click', handleClick);
            if (currentMount.contains(renderer.domElement)) {
                currentMount.removeChild(renderer.domElement);
            }
            renderer.dispose();
            controls.dispose();
        };
    }, [graphData, knowledgePoints]); // 只依赖图谱数据，搜索状态通过ref读取

    return (
        <div className="threejs-page-root">
            <div
                ref={mountRef}
                className="threejs-page-canvas"
            />
            {/* 搜索框 */}
            <div style={{
                position: 'fixed',
                top: '100px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
            }}>
                {/* 搜索输入框 */}
                <div style={{
                    background: 'rgba(10, 15, 30, 0.9)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '12px',
                    border: '1px solid rgba(100, 150, 200, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 16px',
                    gap: '10px',
                    width: '320px'
                }}>
                    <span style={{ fontSize: '16px', opacity: 0.6 }}>🔍</span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索知识点、标签、分类..."
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#fff',
                            fontSize: '14px'
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#666',
                                cursor: 'pointer',
                                fontSize: '16px',
                                padding: '0',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            title="清除搜索"
                        >
                            ×
                        </button>
                    )}
                </div>
                
                {/* 搜索结果标签 - 水平排列 */}
                {searchQuery && filteredNodeIds.size > 0 && (
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: '8px',
                        maxWidth: '400px'
                    }}>
                        {knowledgePoints
                            .filter(kp => filteredNodeIds.has(kp._id))
                            .slice(0, 5)
                            .map(kp => (
                                <div
                                    key={kp._id}
                                    onClick={() => {
                                        setSelectedNodeData(kp);
                                        setSearchQuery('');
                                    }}
                                    style={{
                                        background: 'rgba(10, 15, 30, 0.85)',
                                        backdropFilter: 'blur(10px)',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(100, 150, 200, 0.25)',
                                        padding: '6px 14px',
                                        fontSize: '13px',
                                        color: 'rgba(255, 255, 255, 0.85)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(30, 50, 80, 0.9)';
                                        e.currentTarget.style.borderColor = 'rgba(100, 180, 255, 0.5)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(10, 15, 30, 0.85)';
                                        e.currentTarget.style.borderColor = 'rgba(100, 150, 200, 0.25)';
                                    }}
                                >
                                    {kp.title}
                                </div>
                            ))}
                        {filteredNodeIds.size > 5 && (
                            <div style={{
                                padding: '6px 14px',
                                fontSize: '12px',
                                color: 'rgba(255, 255, 255, 0.5)'
                            }}>
                                +{filteredNodeIds.size - 5} 更多
                            </div>
                        )}
                    </div>
                )}
                
                {/* 无结果提示 */}
                {searchQuery && filteredNodeIds.size === 0 && (
                    <div style={{
                        fontSize: '13px',
                        color: 'rgba(255, 150, 150, 0.8)',
                        padding: '6px 14px',
                        background: 'rgba(255, 100, 100, 0.1)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 100, 100, 0.2)'
                    }}>
                        未找到匹配的知识点
                    </div>
                )}
            </div>
            
            <button 
                className="toggle-edges-btn"
                onClick={() => {
                    const newState = !showEdges;
                    setShowEdges(newState);
                    edgeLinesRef.current.forEach(line => {
                        line.visible = newState;
                    });
                }}
            >
                {showEdges ? '🔗 隐藏连接线' : '🔗 显示连接线'}
            </button>
            
            {/* 悬停提示卡片 */}
            {hoveredNodeData && !selectedNodeData && (
                <div style={{
                    position: 'fixed',
                    right: '25px',
                    top: '120px',
                    width: '320px',
                    maxHeight: '400px',
                    background: 'rgba(0,5,17,0.98)',
                    backdropFilter: 'blur(20px)',
                    color: 'white',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,204,255,0.4), 0 0 20px rgba(0,204,255,0.3)',
                    border: '2px solid rgba(0,204,255,0.5)',
                    overflow: 'auto',
                    zIndex: 999,
                    animation: 'slideIn 0.2s ease-out',
                    transition: 'all 0.2s ease',
                    pointerEvents: 'none' // 不阻挡鼠标
                }}>
                    <div style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold', 
                        color: '#00ccff', 
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span>🌟</span>
                        <span>{hoveredNodeData.title}</span>
                    </div>
                    <div 
                        style={{ 
                            lineHeight: '1.6', 
                            color: '#ccc', 
                            fontSize: '13px',
                            maxHeight: '300px',
                            overflow: 'auto'
                        }}
                        dangerouslySetInnerHTML={{ 
                            __html: DOMPurify.sanitize(
                                hoveredNodeData.content 
                                    ? (hoveredNodeData.content.length > 300 
                                        ? hoveredNodeData.content.substring(0, 300) + '...' 
                                        : hoveredNodeData.content)
                                    : '暂无内容'
                            ) 
                        }} 
                    />
                    <div style={{
                        marginTop: '15px',
                        paddingTop: '15px',
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '12px',
                        color: '#999',
                        textAlign: 'center'
                    }}>
                        💡 点击星球查看完整内容
                    </div>
                </div>
            )}
            
            {/* 详情卡片 */}
            {selectedNodeData && (
                <div style={{
                    position: 'fixed',
                    right: '25px',
                    bottom: '25px',
                    width: '350px',
                    maxHeight: '500px',
                    background: 'rgba(0,5,17,0.95)',
                    backdropFilter: 'blur(15px)',
                    color: 'white',
                    padding: '25px',
                    borderRadius: '15px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.8), 0 0 30px rgba(0,204,255,0.6)',
                    border: '2px solid rgba(0,204,255,0.7)',
                    overflow: 'auto',
                    zIndex: 1000,
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, fontSize: '22px', color: '#00ccff' }}>
                            🪐 {selectedNodeData.title}
                        </h3>
                        <button
                            onClick={() => setSelectedNodeData(null)}
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.3)',
                                color: '#fff',
                                cursor: 'pointer',
                                borderRadius: '50%',
                                width: '30px',
                                height: '30px',
                                fontSize: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                    <div 
                        style={{ 
                            lineHeight: '1.8', 
                            color: '#ccc', 
                            fontSize: '15px',
                            maxHeight: '300px',
                            overflow: 'auto',
                            marginBottom: '20px'
                        }}
                        dangerouslySetInnerHTML={{ 
                            __html: DOMPurify.sanitize(selectedNodeData.content || '暂无内容') 
                        }} 
                    />
                    {selectedNodeData.category && (
                        <div style={{
                            marginTop: '15px',
                            padding: '8px 15px',
                            background: 'rgba(0,204,255,0.1)',
                            border: '1px solid rgba(0,204,255,0.3)',
                            borderRadius: '8px',
                            fontSize: '13px',
                            color: '#00ccff'
                        }}>
                            📂 分类: {selectedNodeData.category}
                        </div>
                    )}
                    
                    {/* 标签管理区域 */}
                    <div style={{
                        marginTop: '20px',
                        padding: '15px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '10px',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '12px'
                        }}>
                            <div style={{
                                fontSize: '14px',
                                fontWeight: 'bold',
                                color: '#00ccff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <span>🏷️</span>
                                <span>标签管理</span>
                            </div>
                            <button
                                onClick={() => setEditingTags(!editingTags)}
                                style={{
                                    background: editingTags ? 'rgba(255,193,7,0.2)' : 'rgba(0,204,255,0.2)',
                                    border: `1px solid ${editingTags ? 'rgba(255,193,7,0.5)' : 'rgba(0,204,255,0.5)'}`,
                                    color: editingTags ? '#ffc107' : '#00ccff',
                                    cursor: 'pointer',
                                    borderRadius: '6px',
                                    padding: '4px 12px',
                                    fontSize: '12px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {editingTags ? '✓ 完成' : '✏️ 编辑'}
                            </button>
                        </div>
                        
                        {/* 标签显示 */}
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '8px',
                            marginBottom: editingTags ? '12px' : '0'
                        }}>
                            {(selectedNodeData.tags || []).length === 0 ? (
                                <div style={{
                                    fontSize: '12px',
                                    color: '#666',
                                    fontStyle: 'italic'
                                }}>
                                    暂无标签
                                </div>
                            ) : (
                                (selectedNodeData.tags || []).map((tag, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '6px 12px',
                                            background: 'rgba(0,204,255,0.15)',
                                            border: '1px solid rgba(0,204,255,0.3)',
                                            borderRadius: '20px',
                                            fontSize: '12px',
                                            color: '#00ccff',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <span>{tag}</span>
                                        {editingTags && (
                                            <button
                                                onClick={() => handleRemoveTag(tag)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#ff4444',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    padding: '0',
                                                    width: '16px',
                                                    height: '16px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.transform = 'scale(1.2)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'scale(1)';
                                                }}
                                                title="删除标签"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                        
                        {/* 添加标签输入框 */}
                        {editingTags && (
                            <div style={{
                                display: 'flex',
                                gap: '8px',
                                marginTop: '12px'
                            }}>
                                <input
                                    type="text"
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleAddTag();
                                        }
                                    }}
                                    placeholder="输入新标签..."
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '6px',
                                        color: '#fff',
                                        fontSize: '12px',
                                        outline: 'none',
                                        transition: 'all 0.2s'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(0,204,255,0.5)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    }}
                                />
                                <button
                                    onClick={handleAddTag}
                                    disabled={!newTag.trim()}
                                    style={{
                                        padding: '8px 16px',
                                        background: newTag.trim() ? 'rgba(0,204,255,0.3)' : 'rgba(100,100,100,0.2)',
                                        border: `1px solid ${newTag.trim() ? 'rgba(0,204,255,0.5)' : 'rgba(100,100,100,0.3)'}`,
                                        borderRadius: '6px',
                                        color: newTag.trim() ? '#00ccff' : '#666',
                                        fontSize: '12px',
                                        cursor: newTag.trim() ? 'pointer' : 'not-allowed',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (newTag.trim()) {
                                            e.currentTarget.style.background = 'rgba(0,204,255,0.4)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (newTag.trim()) {
                                            e.currentTarget.style.background = 'rgba(0,204,255,0.3)';
                                        }
                                    }}
                                >
                                    ➕ 添加
                                </button>
                            </div>
                        )}
                        
                        <div style={{
                            marginTop: '10px',
                            fontSize: '11px',
                            color: '#666',
                            textAlign: 'center'
                        }}>
                            💡 标签用于自动连接相关知识点
                        </div>
                    </div>
                    {/* 编辑按钮 */}
                    <button
                        onClick={() => navigate(`/kp/edit/${selectedNodeData._id}`)}
                        style={{
                            width: '100%',
                            marginTop: '20px',
                            padding: '12px 20px',
                            background: 'linear-gradient(135deg, #00ccff 0%, #0088cc 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#000',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(0,204,255,0.3)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,204,255,0.5)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,204,255,0.3)';
                        }}
                    >
                        <span>✏️</span>
                        <span>编辑知识点</span>
                    </button>
                </div>
            )}
        </div>
    );
}

export default ThreeJSPage;
