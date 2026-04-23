import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as d3 from 'd3-force-3d';
import DOMPurify from 'dompurify';
import apiClient from '../api/axios';

// 关系类型配置（与 RelationshipManager 保持一致）
const RELATION_TYPES = {
    'prerequisite': { label: '前置知识', color: 0xff4444, icon: '⬅️' },
    'derived': { label: '派生', color: 0x44ff44, icon: '🌿' },
    'similar': { label: '相似', color: 0x4444ff, icon: '🔄' },
    'contrast': { label: '对比', color: 0xffaa00, icon: '⚖️' },
    'application': { label: '应用', color: 0xff44ff, icon: '🎯' },
    'includes': { label: '包含', color: 0x44ffff, icon: '📦' },
    'reference': { label: '引用', color: 0xaaaaaa, icon: '🔗' }
};

// 可视化参数配置
const VISUAL_CONFIG = {
    // 行星参数
    PLANET_SIZE_MIN: 6,
    PLANET_SIZE_RANGE: 4,
    PLANET_SPHERE_SEGMENTS: 64,
    
    // 分布参数
    ORBIT_RADIUS_MIN: 90,
    ORBIT_RADIUS_RANGE: 90,
    
    // 地球参数
    EARTH_RADIUS: 25,
    EARTH_ATMOSPHERE_RADIUS: 28.5,
    
    // 陨石带参数
    ASTEROID_SIZE: 0.35,
    ASTEROID_COUNT_MIN: 60,
    ASTEROID_COUNT_MAX: 180,
    ASTEROID_DENSITY: 1.2,
    ASTEROID_TUBE_RADIUS: 3.0,
    ASTEROID_SPEED_MIN: 0.01,
    ASTEROID_SPEED_RANGE: 0.03,
    
    // 交互参数
    HOVER_SCALE_TARGET: 1.8,
    HOVER_SCALE_NEIGHBOR: 1.3,
    HOVER_SCALE_IRRELEVANT: 0.6,
    SELECTED_SCALE: 1.5,
    
    // 性能参数
    FPS_TARGET_MIN: 48,
    FPS_TARGET_MAX: 58,
    CULLING_DISTANCE: 750,
    
    // 星空参数
    STAR_COUNT: 10000,
    STAR_SIZE: 1.5,
    STAR_SPREAD: 2500
};

// UI样式配置
const UI_STYLES = {
    fullScreenContainer: {
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    cosmicBackground: {
        background: 'linear-gradient(to bottom, #000511, #000000)',
        color: '#fff'
    },
    glassCard: {
        background: 'rgba(0,5,17,0.9)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        border: '2px solid rgba(0,204,255,0.5)',
        boxShadow: '0 5px 20px rgba(0,0,0,0.5)'
    },
    detailCard: {
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
    }
};

function KnowledgeUniversePage() {
    const mountRef = useRef(null);
    const labelsContainerRef = useRef(null);
    const labelsRef = useRef([]);
    const hoverState = useRef(null); // { nodeIdx, neighbors: Set<int>, links: Set<int> }
    const planetsRef = useRef([]); // 存储planets数组，供搜索和路径功能使用
    const cameraRef = useRef(null); // 存储相机引用
    const controlsRef = useRef(null); // 存储控制器引用
    const [knowledgePoints, setKnowledgePoints] = useState([]);
    const [relations, setRelations] = useState([]); // 新增：关系数据
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedNodeData, setSelectedNodeData] = useState(null);
    const [displayMode, setDisplayMode] = useState('semantic'); // 'semantic' | 'tags' | 'mixed'
    const [searchQuery, setSearchQuery] = useState(''); // 搜索关键词
    const [searchResults, setSearchResults] = useState([]); // 搜索结果

    // 搜索功能：实时过滤知识点
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const query = searchQuery.toLowerCase().trim();
        
        // 模糊匹配：标题、分类、标签、内容
        const results = knowledgePoints.filter(kp => {
            // 匹配标题
            if (kp.title && kp.title.toLowerCase().includes(query)) {
                return true;
            }
            // 匹配分类
            if (kp.category && kp.category.toLowerCase().includes(query)) {
                return true;
            }
            // 匹配标签
            if (kp.tags && Array.isArray(kp.tags)) {
                if (kp.tags.some(tag => tag.toLowerCase().includes(query))) {
                    return true;
                }
            }
            // 匹配内容（移除HTML标签后匹配）
            if (kp.content) {
                const textContent = kp.content.replace(/<[^>]*>/g, '').toLowerCase();
                if (textContent.includes(query)) {
                    return true;
                }
            }
            return false;
        });

        // 按匹配度排序：标题匹配 > 分类匹配 > 标签匹配 > 内容匹配
        results.sort((a, b) => {
            const aTitle = a.title?.toLowerCase().includes(query) ? 3 : 0;
            const aCategory = a.category?.toLowerCase().includes(query) ? 2 : 0;
            const aTags = a.tags?.some(tag => tag.toLowerCase().includes(query)) ? 1 : 0;
            const aScore = aTitle + aCategory + aTags;

            const bTitle = b.title?.toLowerCase().includes(query) ? 3 : 0;
            const bCategory = b.category?.toLowerCase().includes(query) ? 2 : 0;
            const bTags = b.tags?.some(tag => tag.toLowerCase().includes(query)) ? 1 : 0;
            const bScore = bTitle + bCategory + bTags;

            return bScore - aScore;
        });

        // 最多显示10个结果
        setSearchResults(results.slice(0, 10).map(kp => ({
            id: kp._id,
            title: kp.title,
            category: kp.category,
            tags: kp.tags
        })));
    }, [searchQuery, knowledgePoints]);

    // 点击搜索结果，相机飞到目标星球
    const flyToNode = (nodeId) => {
        const planets = planetsRef.current;
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        
        if (!planets || !camera || !controls) return;
        
        // 找到对应的星球
        const targetPlanet = planets.find(p => p.userData.id === nodeId);
        if (!targetPlanet) return;
        
        // 获取星球的世界坐标（因为galaxyGroup在旋转）
        const targetPos = new THREE.Vector3();
        targetPlanet.getWorldPosition(targetPos);
        
        // 计算相机位置（星球前方一定距离）
        const direction = targetPos.clone().normalize();
        const distance = 80; // 相机到星球的距离
        const cameraTarget = targetPos.clone().add(direction.multiplyScalar(distance));
        
        // 平滑移动相机（动画）
        const startPos = camera.position.clone();
        const startTarget = controls.target.clone();
        
        let progress = 0;
        const duration = 1500; // 1.5秒
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            progress = Math.min(elapsed / duration, 1);
            
            // 缓动函数（easeInOutCubic）
            const eased = progress < 0.5 
                ? 4 * progress * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            // 插值相机位置
            camera.position.lerpVectors(startPos, cameraTarget, eased);
            controls.target.lerpVectors(startTarget, targetPos, eased);
            controls.update();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // 动画结束，高亮星球
                setSelectedNodeData(targetPlanet.userData);
                // 清空搜索框
                setSearchQuery('');
            }
        };
        
        animate();
    };

    // 飞回宇宙全局视角
    const flyBackToOverview = () => {
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        
        if (!camera || !controls) return;
        
        // 默认视角位置
        const defaultCameraPos = new THREE.Vector3(0, 40, 380);
        const defaultTarget = new THREE.Vector3(0, 0, 0);
        
        // 平滑飞回
        const startPos = camera.position.clone();
        const startTarget = controls.target.clone();
        
        let progress = 0;
        const duration = 1500; // 1.5秒
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            progress = Math.min(elapsed / duration, 1);
            
            // 缓动函数
            const eased = progress < 0.5 
                ? 4 * progress * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            // 插值相机位置
            camera.position.lerpVectors(startPos, defaultCameraPos, eased);
            controls.target.lerpVectors(startTarget, defaultTarget, eased);
            controls.update();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    };

    // 获取知识点和关系数据
    useEffect(() => {
        apiClient.get('/knowledge-points')
            .then(res => {
                const data = res.data;
                // 后端现在返回 { knowledgePoints, relations }
                const kps = Array.isArray(data) ? data : (Array.isArray(data?.knowledgePoints) ? data.knowledgePoints : []);
                const rels = Array.isArray(data?.relations) ? data.relations : [];
                
                if (kps.length === 0) {
                    setError('还没有知识点,快去创建吧!');
                } else {
                    setKnowledgePoints(kps);
                    setRelations(rels);
                    if (import.meta.env.DEV) {
                        console.log('加载知识点:', kps.length, '个');
                        console.log('加载关系:', rels.length, '个');
                    }
                }
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch knowledge points', err);
                setError('网络连接失败,请稍后重试');
                setLoading(false);
            });
    }, []);

    // 初始化3D场景
    useEffect(() => {
        if (!mountRef.current || knowledgePoints.length === 0) return;

        const currentMount = mountRef.current;
        const width = currentMount.clientWidth;
        const height = currentMount.clientHeight;

        // === Asteroid Trails 工具与共享资源 ===
        // 1. 几何体：兼顾可见性与性能
        // InstancedMesh 技术极其高效，渲染数万个此类小物体对现代显卡几乎无压力
        const rockGeometry = new THREE.DodecahedronGeometry(VISUAL_CONFIG.ASTEROID_SIZE, 0);
        
        // 2. 材质：高亮设置，确保清晰可见
        // 使用白色基础材质，让 setColorAt 的颜色能完全显示
        const rockMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff, // 纯白色，不影响实例颜色
            roughness: 0.4,  // 更光滑，反光更强
            metalness: 0.6,  // 提高金属感，增强反光
            emissive: 0xffffff, // 白色自发光，让实例颜色发光
            emissiveIntensity: 0.3, // 中等自发光强度，增强可见性
            flatShading: true
        });
        
        /**
         * 创建两点间的直线路径（用于陨石带路径）
         * @param {THREE.Vector3} src - 起始行星位置
         * @param {THREE.Vector3} dst - 目标行星位置
         * @returns {THREE.LineCurve3} 直线路径对象
         */
        const createStraightPath = (src, dst) => {
            return new THREE.LineCurve3(src.clone(), dst.clone()); 
        };

        // 创建单条“陨石流” (Asteroid Trail) - 支持关系类型颜色
        const createAsteroidTrail = (sourceIdx, targetIdx, linkMetadata = {}) => {
            const src = planets[sourceIdx].position.clone();
            const dst = planets[targetIdx].position.clone();
            
            // 根据关系类型选择颜色
            const baseColor = linkMetadata.color || 0xe0e0e0;
            const isSemantic = linkMetadata.isSemantic || false;
            
            // 对于直线，方向不敏感，但保留逻辑
            let start = src, end = dst, fromIdx = sourceIdx, toIdx = targetIdx;

            // 直线路径（为了计算点位）
            const curve = new THREE.LineCurve3(start, end);
            const distance = start.distanceTo(end);
            
            // 数量：保持较高密度，形成带状
            const COUNT = Math.max(
                VISUAL_CONFIG.ASTEROID_COUNT_MIN, 
                Math.min(VISUAL_CONFIG.ASTEROID_COUNT_MAX, Math.floor(distance * VISUAL_CONFIG.ASTEROID_DENSITY))
            );
            
            // 管道半径：扩大散布范围，让陨石散开形成带状
            const tubeRadius = VISUAL_CONFIG.ASTEROID_TUBE_RADIUS;

            const mesh = new THREE.InstancedMesh(rockGeometry, rockMaterial, COUNT);
            mesh.frustumCulled = false;
            if (mesh.instanceMatrix && mesh.instanceMatrix.setUsage) {
                mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            }
            
            // 🎨 基于关系类型的颜色调色板（增强亮度）
            const mainColor = new THREE.Color(baseColor);
            const palette = [
                mainColor.clone().multiplyScalar(2.5),   // 超亮色
                mainColor.clone().multiplyScalar(2.0),   // 很亮
                mainColor.clone().multiplyScalar(1.8),   // 亮色
                mainColor.clone().multiplyScalar(1.5)    // 中亮
            ];
            
            for(let i=0; i<COUNT; i++) {
                const color = palette[Math.floor(Math.random() * palette.length)];
                // 保持高亮度，轻微变化
                color.multiplyScalar(1.2 + Math.random() * 0.6); // 范围：1.2-1.8
                mesh.setColorAt(i, color);
            }
            mesh.instanceColor.needsUpdate = true;

            // 预计算数据
            const baseT = new Float32Array(COUNT);
            const speed = new Float32Array(COUNT);
            
            // 使用 3D 缩放来实现形状差异 (Non-uniform scaling)
            const scale3D = new Float32Array(COUNT * 3);
            
            // 轨道参数
            const offsetRadius = new Float32Array(COUNT);
            const offsetAngle = new Float32Array(COUNT);
            const rotAxis = new Float32Array(COUNT * 3); // 随机旋转轴
            const rotSpeed = new Float32Array(COUNT);

            // 临时变量
            const tmpMatrix = new THREE.Matrix4();
            const tmpPos = new THREE.Vector3();
            const tmpScale = new THREE.Vector3();
            const tmpQuat = new THREE.Quaternion();
            const tangent = new THREE.Vector3();
            const up = new THREE.Vector3(0, 1, 0);
            const axisX = new THREE.Vector3(1, 0, 0); // 辅助轴
            const binormal = new THREE.Vector3();
            const normal = new THREE.Vector3();

            for (let i = 0; i < COUNT; i++) {
                baseT[i] = Math.random(); 
                // 速度：模拟太空失重的缓慢漂浮感
                speed[i] = VISUAL_CONFIG.ASTEROID_SPEED_MIN + Math.random() * VISUAL_CONFIG.ASTEROID_SPEED_RANGE;
                
                // 随机形状：尺寸适中 (0.8 ~ 1.5)
                scale3D[i*3 + 0] = 0.8 + Math.random() * 0.7;
                scale3D[i*3 + 1] = 0.8 + Math.random() * 0.7;
                scale3D[i*3 + 2] = 0.8 + Math.random() * 0.7;
                
                offsetRadius[i] = Math.random() * tubeRadius;
                offsetAngle[i] = Math.random() * Math.PI * 2;
                
                // 随机自旋
                rotAxis[i*3 + 0] = Math.random() - 0.5;
                rotAxis[i*3 + 1] = Math.random() - 0.5;
                rotAxis[i*3 + 2] = Math.random() - 0.5;
                rotSpeed[i] = (Math.random() - 0.5) * 2.0;
            }

            mesh.userData = {
                curve,
                baseT,
                speed,
                scale3D,
                offsetRadius,
                offsetAngle,
                rotAxis,
                rotSpeed,
                tmpMatrix,
                tmpPos,
                tmpScale,
                tmpQuat,
                tangent,
                up,
                axisX,
                binormal,
                normal,
                count: COUNT,
                fromIdx,
                toIdx,
                linkMetadata, // 保存关系元数据
            };

            galaxyGroup.add(mesh);
            
            // 创建关系类型标签
            if (linkMetadata.relationType || linkMetadata.isSemantic) {
                const relationConfig = RELATION_TYPES[linkMetadata.relationType] || RELATION_TYPES['reference'];
                const labelText = `${relationConfig.icon} ${relationConfig.label}`;
                
                // 计算中点位置
                const midPoint = new THREE.Vector3(
                    (src.x + dst.x) / 2,
                    (src.y + dst.y) / 2,
                    (src.z + dst.z) / 2
                );
                
                // 创建文字纹理（更大更清晰）
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = 512;
                canvas.height = 128;
                
                // 透明背景，融入场景
                context.clearRect(0, 0, canvas.width, canvas.height);
                
                // 文字发光效果（外发光）
                context.shadowColor = `#${mainColor.getHexString()}`;
                context.shadowBlur = 25;
                context.shadowOffsetX = 0;
                context.shadowOffsetY = 0;
                
                // 主文字（更大字体）
                context.font = 'bold 48px Microsoft YaHei, Arial, sans-serif';
                context.fillStyle = '#ffffff';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(labelText, canvas.width / 2, canvas.height / 2);
                
                // 再画一遍，增加亮度
                context.shadowBlur = 15;
                context.fillText(labelText, canvas.width / 2, canvas.height / 2);
                
                const texture = new THREE.CanvasTexture(canvas);
                const spriteMaterial = new THREE.SpriteMaterial({ 
                    map: texture,
                    transparent: true,
                    depthTest: false, // 始终显示在最前面
                    opacity: 0.95
                });
                const sprite = new THREE.Sprite(spriteMaterial);
                sprite.position.copy(midPoint);
                sprite.scale.set(30, 8, 1); // 加大标签，更易见
                
                galaxyGroup.add(sprite);
                mesh.userData.labelSprite = sprite; // 关联标签
            }
            
            return mesh;
        };
        // 场景（纯黑背景，深邃宇宙）
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000); 

        // 创建一个包含所有行星和连线的星系容器，用于整体旋转
        const galaxyGroup = new THREE.Group();
        scene.add(galaxyGroup);

        // 相机（保持现有视角）
        const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 3000);
        camera.position.set(0, 40, 380);
        cameraRef.current = camera; // 保存引用

        // 渲染器
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        currentMount.appendChild(renderer.domElement);

        // 能力检测与分档（Tier）
        const isWebGL2 = !!renderer.capabilities.isWebGL2;
        const deviceMemory = (navigator && navigator.deviceMemory) ? navigator.deviceMemory : 4;
        const cores = (navigator && navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : 4;
        let tier = 1;
        if (isWebGL2 && deviceMemory >= 4 && cores >= 6) tier = 2;
        if (deviceMemory <= 2 || cores <= 4) tier = 0;
        const tierBudgets = { 0: 1500, 1: 10000, 2: 25000 };
        const instanceBudget = tierBudgets[tier];

        // 光照系统重构（模拟真实太空光照）
        // 1. 微弱的环境光，保证背光面不是死黑
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5); 
        scene.add(ambientLight);

        // 2. 主光源（模拟太阳），侧上方照射，制造明暗立体感
        const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
        sunLight.position.set(100, 50, 100);
        scene.add(sunLight);
        
        // 3. 轮廓补光（背光），增强边缘轮廓
        const rimLight = new THREE.DirectionalLight(0x4455ff, 1.0);
        rimLight.position.set(-50, 0, -20);
        scene.add(rimLight);

        // 控制器（扩大视野范围）
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.minDistance = 50;
        controls.maxDistance = 800;
        controlsRef.current = controls; // 保存引用

        // 星空背景
        const createStars = () => {
            const geometry = new THREE.BufferGeometry();
            const count = VISUAL_CONFIG.STAR_COUNT;
            const positions = new Float32Array(count * 3);

            for (let i = 0; i < count * 3; i++) {
                positions[i] = (Math.random() - 0.5) * VISUAL_CONFIG.STAR_SPREAD;
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const material = new THREE.PointsMaterial({
                color: 0xffffff,
                size: VISUAL_CONFIG.STAR_SIZE,
                transparent: true,
                opacity: 0.6
            });

            return new THREE.Points(geometry, material);
        };

        scene.add(createStars());

        // 中心地球
        const earthGroup = new THREE.Group(); // 地球单独一个组
        scene.add(earthGroup);

        const earthTexture = new THREE.TextureLoader().load(
            'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg'
        );
        
        const earthGeo = new THREE.SphereGeometry(VISUAL_CONFIG.EARTH_RADIUS, 64, 64);
        const earthMat = new THREE.MeshStandardMaterial({
            map: earthTexture,
            roughness: 0.6, // 增加粗糙度，减少类似塑料的高光
            metalness: 0.1, // 降低金属感，更像真实地表
            emissive: new THREE.Color(0x000000), // 关闭自发光！地球本身不发光
            emissiveIntensity: 0.0
        });
        const earth = new THREE.Mesh(earthGeo, earthMat);
        earthGroup.add(earth);

        // 大气层光晕 (Outer Atmosphere Glow) - 锐利的边缘光环
        const vertexShader = `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
        
        // 调整后的 Fragment Shader：更锐利、更蓝、边缘更细
        const fragmentShader = `
            varying vec3 vNormal;
            void main() {
                // 计算视线与法线的点积，边缘处接近0
                float intensity = pow(0.55 - dot(vNormal, vec3(0, 0, 1.0)), 5.0);
                // 这种电光蓝颜色 (0.2, 0.6, 1.0) 加上高强度
                gl_FragColor = vec4(0.2, 0.6, 1.0, 1.0) * intensity * 2.0;
            }
        `;
        
        const atmosphereGeo = new THREE.SphereGeometry(VISUAL_CONFIG.EARTH_ATMOSPHERE_RADIUS, 64, 64);
        const atmosphereMat = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide, // 渲染背面，形成光环
            transparent: true,
            depthWrite: false
        });
        const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
        earthGroup.add(atmosphere);

        // 内部辉光 (Inner Glow) - 仅在边缘增强，模拟瑞利散射
        const innerGlowGeo = new THREE.SphereGeometry(VISUAL_CONFIG.EARTH_RADIUS, 64, 64);
        const innerGlowMat = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: `
                varying vec3 vNormal;
                void main() {
                    // 只有在极边缘才显示出来的内部辉光
                    float intensity = pow(1.0 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
                    gl_FragColor = vec4(0.1, 0.5, 1.0, 1.0) * intensity * 0.8;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.FrontSide,
            transparent: true,
            depthWrite: false
        });
        const innerGlow = new THREE.Mesh(innerGlowGeo, innerGlowMat);
        earthGroup.add(innerGlow);

        // 行星纹理配置（使用本地下载的真实纹理）
        const textureLoader = new THREE.TextureLoader();
        
        const planetTextures = [
            { 
                url: '/textures/mercury.jpg',
                type: 'mercury',
                color: '#8c7853',
                emissive: '#5a4a3a',
                roughness: 1.0
            },
            { 
                url: '/textures/mars.jpg',
                type: 'mars',
                color: '#e67e22',
                emissive: '#8b4513',
                roughness: 0.9
            },
            { 
                url: '/textures/venus.jpg',
                type: 'venus',
                color: '#f39c12',
                emissive: '#e67e22',
                roughness: 0.8
            },
            { 
                url: '/textures/jupiter.jpg',
                type: 'jupiter',
                color: '#d4a373',
                emissive: '#b8860b',
                roughness: 0.6
            },
            { 
                url: '/textures/saturn.jpg',
                type: 'saturn',
                color: '#f0e68c',
                emissive: '#daa520',
                roughness: 0.7
            },
            { 
                url: '/textures/uranus.jpg',
                type: 'uranus',
                color: '#4fc3f7',
                emissive: '#0288d1',
                roughness: 0.5
            },
            { 
                url: '/textures/neptune.jpg',
                type: 'neptune',
                color: '#1a3a70',
                emissive: '#0d1f3d',
                roughness: 0.5
            },
            { 
                url: '/textures/pluto.jpg',
                type: 'pluto',
                color: '#b5a597',
                emissive: '#8b7d71',
                roughness: 1.0
            }
        ];

        // 创建知识点行星（数据驱动）
        if (import.meta.env.DEV) {
            console.log('创建行星，知识点数量:', knowledgePoints.length);
        }
        
        const planets = knowledgePoints.map((kp, index) => {
            const size = VISUAL_CONFIG.PLANET_SIZE_MIN + Math.random() * VISUAL_CONFIG.PLANET_SIZE_RANGE;
            const textureConfig = planetTextures[index % planetTextures.length];

            const geometry = new THREE.SphereGeometry(size, VISUAL_CONFIG.PLANET_SPHERE_SEGMENTS, VISUAL_CONFIG.PLANET_SPHERE_SEGMENTS);
            
            const material = new THREE.MeshStandardMaterial({
                roughness: 0.8, // 统一粗糙度，模拟真实岩石/气体表面
                metalness: 0.0, // 非金属
                emissive: new THREE.Color(textureConfig.emissive),
                emissiveIntensity: 0.05 // 极低自发光，主要靠恒星光照，模拟真实行星
            });

            const planet = new THREE.Mesh(geometry, material);
            
            // 加载纹理（带fallback）- 修复闭包bug
            const texture = textureLoader.load(
                textureConfig.url,
                undefined,
                undefined,
                () => {
                    // 纹理加载失败时使用纯色
                    if (planet && planet.material) {
                        planet.material.map = null;
                        planet.material.color = new THREE.Color(textureConfig.color);
                        planet.material.needsUpdate = true;
                    }
                }
            );
            material.map = texture;
            
            // 计算位置（球形分布 - 黄金螺旋算法）
            // 使用 Fibonacci Sphere 算法保证初始分布均匀，避免重叠
            const phi = Math.acos(1 - 2 * (index + 0.5) / knowledgePoints.length); // 极角 0 -> PI
            const theta = Math.PI * (1 + Math.sqrt(5)) * (index + 0.5); // 黄金角螺旋
            
            const r = VISUAL_CONFIG.ORBIT_RADIUS_MIN + Math.random() * VISUAL_CONFIG.ORBIT_RADIUS_RANGE;
            
            // 球坐标转笛卡尔坐标 (Y轴向上)
            const posX = r * Math.sin(phi) * Math.cos(theta);
            const posY = r * Math.cos(phi);
            const posZ = r * Math.sin(phi) * Math.sin(theta);
            
            planet.position.x = posX;
            planet.position.y = posY;
            planet.position.z = posZ;

            // 完整的userData（数据驱动）
            planet.userData = {
                id: kp._id,
                title: kp.title,
                content: kp.content,
                category: kp.category,
                size: size,
                rotationSpeed: 0.005 + Math.random() * 0.01,
                originalColor: new THREE.Color(textureConfig.color),
                textureConfig: textureConfig,
                hasTexture: true
            };

            galaxyGroup.add(planet); // 添加到旋转组
            return planet;
        });
        
        // 保存planets引用供外部使用
        planetsRef.current = planets;
        
        if (import.meta.env.DEV) {
            console.log('所有行星已添加到场景，总数:', planets.length);
            console.log('场景中的子对象数量:', scene.children.length);
        }

        // 使用d3-force-3d预计算最优位置
        const forceData = planets.map((planet, i) => {
            const pos = planet.position;
            return {
                id: planet.userData.id,
                index: i,
                x: pos.x,
                y: pos.y,
                z: pos.z,
                radius: planet.userData.size * 2  // 关键修复：直接存储碰撞半径
            };
        });

        // 💡 新：生成连接线数据（支持三种模式）
        const linkData = [];
        const addedLinks = new Map(); // key -> link metadata
        
        // 辅助函数：添加连接
        const addLink = (sourceIdx, targetIdx, metadata = {}) => {
            if (sourceIdx === targetIdx) return;
            const key = sourceIdx < targetIdx ? `${sourceIdx}-${targetIdx}` : `${targetIdx}-${sourceIdx}`;
            if (!addedLinks.has(key)) {
                linkData.push({ 
                    source: sourceIdx, 
                    target: targetIdx,
                    ...metadata
                });
                addedLinks.set(key, metadata);
            }
        };
        
        // 模式 1: 语义关系（显式定义的知识图谱）
        if (displayMode === 'semantic' || displayMode === 'mixed') {
            relations.forEach(rel => {
                const sourceIdx = knowledgePoints.findIndex(kp => kp._id === rel.source);
                const targetIdx = knowledgePoints.findIndex(kp => kp._id === rel.target);
                
                if (sourceIdx !== -1 && targetIdx !== -1) {
                    const config = RELATION_TYPES[rel.relationType] || RELATION_TYPES['reference'];
                    addLink(sourceIdx, targetIdx, {
                        relationType: rel.relationType,
                        color: config.color,
                        strength: rel.strength || 0.5,
                        description: rel.description,
                        isSemantic: true // 标记为语义关系
                    });
                }
            });
        }
        
        // 模式 2: 标签推断（自动生成）
        if (displayMode === 'tags' || displayMode === 'mixed') {
            knowledgePoints.forEach((kp1, i) => {
                const tags1 = kp1.tags || [];
                if (tags1.length === 0) return;
                
                knowledgePoints.forEach((kp2, j) => {
                    if (i >= j) return;
                    
                    const tags2 = kp2.tags || [];
                    const commonTags = tags1.filter(tag => tags2.includes(tag));
                    
                    if (commonTags.length > 0) {
                        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
                        // 如果已经有语义关系，则跳过
                        if (!addedLinks.has(key)) {
                            addLink(i, j, {
                                relationType: 'similar',
                                color: 0x666666, // 灰色，区分于语义关系
                                strength: 0.3,
                                isSemantic: false, // 标记为标签推断
                                commonTags: commonTags
                            });
                        }
                    }
                });
            });
        }
        // if (linkData.length < knowledgePoints.length * 0.5) { ... }
        
        // 构建邻接表，用于快速查找
        const adjacency = new Array(knowledgePoints.length).fill(0).map(() => []);
        linkData.forEach((link, linkIdx) => {
            adjacency[link.source].push({ nodeIdx: link.target, linkIdx });
            adjacency[link.target].push({ nodeIdx: link.source, linkIdx });
        });

        if (import.meta.env.DEV) {
            console.log('连接线数量:', linkData.length);
            console.log('连接策略: 严格基于标签匹配与显式关系');
        }

        // 径向约束力（扩大最大半径）
        function radialForce() {
            const maxRadius = 180; // 原80，现180
            const strength = 0.1;
            
            return () => {
                forceData.forEach(d => {
                    const r = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
                    if (r > maxRadius) {
                        const scale = (maxRadius / r) * strength;
                        d.vx += (0 - d.x) * scale;
                        d.vy += (0 - d.y) * scale;
                        d.vz += (0 - d.z) * scale;
                    }
                });
            };
        }

        // 力导向模拟（实时运行）
        const simulation = d3.forceSimulation()
            .numDimensions(3) // 必须先设置维度
            .nodes(forceData) // 然后添加节点
            .force('charge', d3.forceManyBody().strength(-120)) // 增强排斥力，让行星更分散
            .force('center', d3.forceCenter(0, 0, 0).strength(0.08)) // 减弱中心引力
            .force('collision', d3.forceCollide().radius(d => d.radius * 2).strength(1.0)) // 加大碰撞半径
            .force('radial', radialForce()) // 添加径向约束
            .alphaDecay(0.02)
            .velocityDecay(0.6)
            .alphaMin(0.001); // 保持低速运行，不完全停止
        
        // 如果有连接线，添加link力（需要转换为节点对象引用）
        if (linkData.length > 0) {
            // 将索引转换为实际节点对象引用
            const linkRefs = linkData.map(link => ({
                source: forceData[link.source],
                target: forceData[link.target]
            }));
            
            simulation.force('link', d3.forceLink(linkRefs)
                .distance(80)  // 原40，现在80，让连线更长
                .strength(0.3)  // 减弱连线强度，避免拉得太紧
            );
        }

        if (import.meta.env.DEV) {
            console.log('力导向模拟开始前，检查第一个节点:', forceData[0]);
        }
        
        // 预运行50次快速达到初始稳定（减少初始化时间）
        for (let i = 0; i < 50; i++) {
            simulation.tick();
            if (import.meta.env.DEV && i === 0) {
                console.log('第1次tick后，第一个节点:', forceData[0]);
            }
        }
        
        if (import.meta.env.DEV) {
            console.log('50次tick后，第一个节点:', forceData[0]);
        }

        // 应用初始位置
        forceData.forEach((d, i) => {
            const planet = planets[i];
            if (!planet) {
                console.error(`节点${i}不存在`);
                return;
            }
            
            // NaN检查与安全恢复
            if (isNaN(d.x) || isNaN(d.y) || isNaN(d.z)) {
                console.error(`节点${i}位置为NaN:`, d);
                // 使用安全的默认值（球面上的随机点）
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = 90 + Math.random() * 90;
                d.x = r * Math.sin(phi) * Math.cos(theta);
                d.y = r * Math.cos(phi);
                d.z = r * Math.sin(phi) * Math.sin(theta);
            }
            
            planet.position.set(d.x, d.y, d.z);
        });
        
        // 🔥 性能保护：节点数量过多时降低力导向更新频率
        const forceUpdateInterval = knowledgePoints.length > 50 ? 3 : 1; // >50个节点时每3帧更新一次
        let forceFrameCounter = 0;
        
        if (import.meta.env.DEV) {
            console.log('力导向后的行星位置范围:');
            const distances = forceData.map(d => Math.sqrt(d.x*d.x + d.y*d.y + d.z*d.z));
            console.log('最小距离:', Math.min(...distances).toFixed(2));
            console.log('最大距离:', Math.max(...distances).toFixed(2));
            console.log('平均距离:', (distances.reduce((a,b)=>a+b)/distances.length).toFixed(2));
        }

        // 计算每条连接的基础密度与全局缩放，满足实例总预算
        const linkMetrics = linkData.map(l => {
            const a = planets[l.source].position;
            const b = planets[l.target].position;
            const d = a.distanceTo(b);
            // 粒子数量更少更精简
            const base = Math.max(20, Math.min(80, Math.floor(d * 0.5)));
            return { l, d, base };
        });
        const sumBase = linkMetrics.reduce((acc, m) => acc + m.base, 0) || 1;
        let globalCountScale = Math.min(1, instanceBudget / sumBase);
        globalCountScale = Math.max(globalCountScale, 0.25);

        // 使用 InstancedMesh 生成“陨石带”（带上关系元数据）
        const asteroidTrails = linkMetrics.map(m => {
            // 传入 link 的元数据（包含关系类型、颜色等）
            const linkMeta = m.l;
            return createAsteroidTrail(linkMeta.source, linkMeta.target, linkMeta);
        });
        // 记录每条 stream 的原始 count
        asteroidTrails.forEach(mesh => { mesh.userData.drawCountBase = mesh.userData.count; });
        // 首次应用全局缩放
        asteroidTrails.forEach(mesh => { mesh.count = Math.max(1, Math.floor(mesh.userData.drawCountBase * globalCountScale)); });

        // 鼠标交互：Raycaster
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        let selectedPlanet = null;

        function onMouseMove(event) {
            if (!currentMount || !event) return;
            
            const rect = currentMount.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            // 射线检测
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(planets);

            if (intersects.length > 0) {
                const object = intersects[0].object;
                let idx = planets.indexOf(object);
                
                if (idx !== -1 && adjacency[idx]) {
                    // 如果已经在悬停这个节点，就不重复计算
                    if (hoverState.current?.nodeIdx !== idx) {
                        const neighbors = new Set(adjacency[idx].map(n => n.nodeIdx));
                        const links = new Set(adjacency[idx].map(n => n.linkIdx));
                        
                        hoverState.current = {
                            nodeIdx: idx,
                            neighbors: neighbors,
                            links: links
                        };
                        document.body.style.cursor = 'pointer';
                    }
                }
            } else {
                if (hoverState.current !== null) {
                    hoverState.current = null;
                    document.body.style.cursor = 'default';
                }
            }
        }

        function onMouseClick() {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(planets);

            if (intersects.length > 0) {
                const clickedObject = intersects[0].object;
                
                // 恢复之前选中的
                if (selectedPlanet) {
                    selectedPlanet.material.emissive.copy(new THREE.Color(selectedPlanet.userData.textureConfig.emissive));
                    selectedPlanet.material.emissiveIntensity = 0.2;
                    selectedPlanet.scale.setScalar(1);
                }

                // 高亮新选中的（增强自发光）
                selectedPlanet = clickedObject;
                selectedPlanet.material.emissive.set(0xffaa00);
                selectedPlanet.material.emissiveIntensity = 0.8;
                selectedPlanet.scale.setScalar(1.5);

                // 显示详情
                setSelectedNodeData(selectedPlanet.userData);
            } else {
                // 点击空白取消选中
                if (selectedPlanet) {
                    selectedPlanet.material.emissive.copy(new THREE.Color(selectedPlanet.userData.textureConfig.emissive));
                    selectedPlanet.material.emissiveIntensity = 0.2;
                    selectedPlanet.scale.setScalar(1);
                    selectedPlanet = null;
                    setSelectedNodeData(null);
                }
            }
        }

        currentMount.addEventListener('mousemove', onMouseMove);
        currentMount.addEventListener('click', onMouseClick);

        // 动画循环
        const clock = new THREE.Clock();
        let fpsAccum = 0, fpsFrames = 0, fpsWindow = 0;
        let drawScale = globalCountScale; // 从全局缩放起步，随后随 FPS 微调
        function animate() {
            requestAnimationFrame(animate);
            const delta = clock.getDelta();
            const fps = 1 / Math.max(1e-4, delta);
            fpsAccum += fps; fpsFrames += 1; fpsWindow += delta;
            if (fpsWindow >= 1.0) {
                const avg = fpsAccum / fpsFrames;
                if (avg < VISUAL_CONFIG.FPS_TARGET_MIN) drawScale = Math.max(0.3, drawScale * 0.9);
                else if (avg > VISUAL_CONFIG.FPS_TARGET_MAX) drawScale = Math.min(1.0, drawScale * 1.05);
                fpsAccum = 0; fpsFrames = 0; fpsWindow = 0;
            }

            // 地球自转
            earth.rotation.y += 0.05 * delta;
            
            // 星系公转（整体缓慢旋转）
            galaxyGroup.rotation.y += 0.025 * delta; // 约40秒一圈
            
            // 计算星系的全局变换矩阵（用于将世界坐标转为屏幕坐标）
            galaxyGroup.updateMatrixWorld();
            const galaxyMatrix = galaxyGroup.matrixWorld;

            // ---------------------------------------------------
            // 视觉状态更新 (Hover Effects)
            // ---------------------------------------------------
            const hover = hoverState.current;

            // 0. 实时力导向更新（性能保护）
            forceFrameCounter++;
            if (forceFrameCounter >= forceUpdateInterval) {
                forceFrameCounter = 0;
                simulation.tick(); // 继续模拟
                
                // 更新行星位置（平滑过渡）
                forceData.forEach((d, i) => {
                    const planet = planets[i];
                    if (planet && !isNaN(d.x) && !isNaN(d.y) && !isNaN(d.z)) {
                        // 使用 lerp 平滑移动，避免突兀
                        planet.position.lerp(new THREE.Vector3(d.x, d.y, d.z), 0.1);
                    }
                });
            }
            
            // 1. 更新行星 (Planets)
            planets.forEach((planet, i) => {
                planet.rotation.y += planet.userData.rotationSpeed;
                
                // 基础状态
                let targetScale = 1.0;
                let targetEmissiveInt = 0.05; // 默认无/弱自发光，还原真实感
                let targetOpacity = 1.0;
                
                if (hover) {
                    if (i === hover.nodeIdx) {
                        // 当前悬停目标：放大，高亮发光
                        targetScale = VISUAL_CONFIG.HOVER_SCALE_TARGET;
                        targetEmissiveInt = 1.5;
                    } else if (hover.neighbors.has(i)) {
                        // 邻居节点：稍微放大，微光
                        targetScale = VISUAL_CONFIG.HOVER_SCALE_NEIGHBOR;
                        targetEmissiveInt = 0.5;
                    } else {
                        // 其他无关节点：变暗，变小
                        targetScale = VISUAL_CONFIG.HOVER_SCALE_IRRELEVANT;
                        targetEmissiveInt = 0.1;
                        targetOpacity = 0.3;
                    }
                } else if (selectedPlanet && planet === selectedPlanet) {
                     // 保持选中状态的高亮
                     targetScale = VISUAL_CONFIG.SELECTED_SCALE;
                     targetEmissiveInt = 0.8;
                }

                // 平滑过渡 (Lerp)
                planet.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
                
                // 材质属性更新
                planet.material.emissiveIntensity += (targetEmissiveInt - planet.material.emissiveIntensity) * 0.1;
                
                // 透明度模拟 (StandardMaterial 不直接支持 alpha 渐变除非开启 transparent，
                // 但我们可以通过修改 color 或 emissive 来模拟变暗)
                // 这里我们主要靠 emissive 和 color 的变暗来模拟“隐身”
                if (hover && !hover.neighbors.has(i) && i !== hover.nodeIdx) {
                    // 变灰暗
                    planet.material.color.lerp(new THREE.Color(0x333333), 0.1);
                } else {
                    // 恢复原色
                    planet.material.color.lerp(planet.userData.originalColor, 0.1);
                }

                // 2. 更新标签位置与样式 (UI Labels)
                const label = labelsRef.current?.[i];
                if (label && currentMount) {
                    // 获取行星的世界坐标 (考虑 galaxyGroup 的旋转)
                    // 必须克隆位置，否则会修改原始位置
                    const worldPos = planet.position.clone().applyMatrix4(galaxyMatrix);
                    
                    // 投影到屏幕坐标
                    worldPos.project(camera);
                    
                    // 转换为 CSS 坐标
                    const x = (worldPos.x * .5 + .5) * currentMount.clientWidth;
                    const y = (worldPos.y * -.5 + .5) * currentMount.clientHeight;

                    // 只有在相机前面的才显示 (z < 1)
                    if (worldPos.z < 1) {
                        label.style.display = 'block';
                        label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
                        
                        // 标签样式根据 Hover 状态变化
                        if (hover) {
                            if (i === hover.nodeIdx) {
                                label.style.opacity = 1;
                                label.style.fontSize = '16px';
                                label.style.color = '#fff';
                                label.style.zIndex = 100;
                                label.style.textShadow = '0 0 10px #00ccff';
                            } else if (hover.neighbors.has(i)) {
                                label.style.opacity = 0.8;
                                label.style.fontSize = '12px';
                                label.style.color = '#ccc';
                                label.style.zIndex = 50;
                                label.style.textShadow = 'none';
                            } else {
                                label.style.opacity = 0.1; // 几乎隐藏无关标签
                                label.style.zIndex = 1;
                                label.style.textShadow = 'none';
                            }
                        } else {
                            // 默认状态
                            label.style.opacity = 0.6;
                            label.style.fontSize = '12px';
                            label.style.color = '#aaa';
                            label.style.zIndex = 10;
                            label.style.textShadow = 'none';
                        }
                    } else {
                        label.style.display = 'none';
                    }
                }
            });

            // 3. 更新陨石带 (Asteroid Trails)
            const elapsed = clock.getElapsedTime();
            asteroidTrails.forEach((mesh, idx) => {
                const ud = mesh.userData;
                
                // 连线可见性判断
                let isVisible = true;
                let speedMultiplier = 1.0;
                let labelOpacity = 0.95; // 默认就很清晰

                if (hover) {
                    if (hover.links.has(idx)) {
                        isVisible = true;
                        speedMultiplier = 4.0; // 关联连线加速流动！
                        labelOpacity = 1.0; // 标签完全不透明
                    } else {
                        isVisible = false; // 隐藏无关连线
                        labelOpacity = 0.1; // 标签几乎透明
                    }
                }

                // 平滑控制可见性 (通过缩放实现消失效果，比直接 visible=false 更平滑)
                // 或者简单点，直接设置 count = 0 或 count = normal
                
                if (!isVisible) {
                     // 逐渐减少 count 模拟消失，或者直接隐藏
                     mesh.visible = false;
                } else {
                     mesh.visible = true;
                }
                
                if (!mesh.visible) return;

                // 视距裁剪
                const cam = camera.position;
                const fromPlanet = planets[ud.fromIdx];
                const toPlanet = planets[ud.toIdx];
                if (!fromPlanet || !toPlanet) return;
                
                const fromP = fromPlanet.position;
                const toP = toPlanet.position;
                const nearScale = (cam.distanceTo(fromP) > VISUAL_CONFIG.CULLING_DISTANCE && 
                                  cam.distanceTo(toP) > VISUAL_CONFIG.CULLING_DISTANCE) ? 0.1 : 1.0;
                mesh.count = Math.max(0, Math.floor(ud.drawCountBase * drawScale * nearScale));

                for (let i = 0; i < mesh.count; i++) {
                    const t = (ud.baseT[i] + elapsed * ud.speed[i] * speedMultiplier) % 1; // 应用速度倍率
                    
                    // 1. 计算曲线位置和切线
                    // LineCurve3 也有 getPointAt 和 getTangentAt
                    ud.curve.getPointAt(t, ud.tmpPos);
                    ud.curve.getTangentAt(t, ud.tangent).normalize();
                    
                    // 2. 构建局部坐标系 (Frenet Frame 简化版)
                    // 如果切线接近 Y 轴，就用 X 轴做参考，否则用 Y 轴
                    const refAxis = Math.abs(ud.tangent.dot(ud.up)) > 0.9 ? ud.axisX : ud.up;
                    ud.binormal.crossVectors(ud.tangent, refAxis).normalize();
                    ud.normal.crossVectors(ud.binormal, ud.tangent).normalize();
                    
                    // 3. 应用管状偏移 (Asteroid Belt Width)
                    const angle = ud.offsetAngle[i]; // 保持角度不变，或者慢慢旋转也行
                    const r = ud.offsetRadius[i];
                    
                    // offset = normal * cos(ang) * r + binormal * sin(ang) * r
                    const offN = ud.normal.clone().multiplyScalar(Math.cos(angle) * r);
                    const offB = ud.binormal.clone().multiplyScalar(Math.sin(angle) * r);
                    ud.tmpPos.add(offN).add(offB);

                    // 4. 自旋 (Tumbling)
                    const rotSpeed = ud.rotSpeed[i];
                    const axis = new THREE.Vector3(ud.rotAxis[i*3], ud.rotAxis[i*3+1], ud.rotAxis[i*3+2]).normalize();
                    ud.tmpQuat.setFromAxisAngle(axis, elapsed * rotSpeed + i); // +i 增加初始相位随机性

                    // 5. 非均匀缩放 (Non-uniform Scaling)
                    ud.tmpScale.set(ud.scale3D[i*3], ud.scale3D[i*3+1], ud.scale3D[i*3+2]);
                    
                    // 组合矩阵
                    ud.tmpMatrix.compose(ud.tmpPos, ud.tmpQuat, ud.tmpScale);
                    mesh.setMatrixAt(i, ud.tmpMatrix);
                }
                mesh.instanceMatrix.needsUpdate = true;
                
                // 更新关系标签的可见性
                if (ud.labelSprite) {
                    ud.labelSprite.visible = mesh.visible;
                    ud.labelSprite.material.opacity = labelOpacity;
                }
            });
            
            /* 移除旧的交互逻辑，避免冲突
            // 悬停检测
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(planets);
            ...
            */

            controls.update();
            renderer.render(scene, camera);
        }

        animate();

        // 窗口自适应
        const handleResize = () => {
            const w = currentMount.clientWidth;
            const h = currentMount.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };

        window.addEventListener('resize', handleResize);

        // 清理
        return () => {
            window.removeEventListener('resize', handleResize);
            currentMount.removeEventListener('mousemove', onMouseMove);
            currentMount.removeEventListener('click', onMouseClick);
            document.body.style.cursor = 'default';
            
            // 停止力导向模拟
            if (simulation) {
                simulation.stop();
            }
            
            // 释放所有几何体和材质
            planets.forEach(p => {
                p.geometry.dispose();
                p.material.dispose();
            });

            // 移除并释放陨石带实例
            if (asteroidTrails && Array.isArray(asteroidTrails)) {
                asteroidTrails.forEach(trail => {
                    if (trail.instanceMatrix?.dispose) {
                        trail.instanceMatrix.dispose();
                    }
                    if (trail.instanceColor?.dispose) {
                        trail.instanceColor.dispose();
                    }
                    galaxyGroup.remove(trail);
                });
            }
            rockGeometry.dispose();
            rockMaterial.dispose();

            earth.geometry.dispose();
            earth.material.dispose();
            atmosphere.geometry.dispose();
            atmosphere.material.dispose();
            innerGlow.geometry.dispose();
            innerGlow.material.dispose();
            
            if (currentMount && renderer.domElement) {
                currentMount.removeChild(renderer.domElement);
            }
            renderer.dispose();
            controls.dispose();
        };
    }, [knowledgePoints, relations, displayMode]);

    if (loading) {
        return (
            <div style={{ ...UI_STYLES.fullScreenContainer, ...UI_STYLES.cosmicBackground, fontSize: '20px' }}>
                <div style={{
                    padding: '25px 45px',
                    ...UI_STYLES.glassCard
                }}>
                    🌌 正在构建知识宇宙...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ 
                ...UI_STYLES.fullScreenContainer, 
                background: '#000', 
                color: '#ff4444', 
                fontSize: '18px' 
            }}>
                <div style={{
                    padding: '25px',
                    borderRadius: '10px',
                    border: '2px solid #ff4444'
                }}>
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
            <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
            
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
                {searchQuery && searchResults.length > 0 && (
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: '8px',
                        maxWidth: '400px'
                    }}>
                        {searchResults.slice(0, 5).map((result) => (
                            <div
                                key={result.id}
                                onClick={() => flyToNode(result.id)}
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
                                {result.title}
                            </div>
                        ))}
                        {searchResults.length > 5 && (
                            <div style={{
                                padding: '6px 14px',
                                fontSize: '12px',
                                color: 'rgba(255, 255, 255, 0.5)'
                            }}>
                                +{searchResults.length - 5} 更多
                            </div>
                        )}
                    </div>
                )}
                
                {/* 无结果提示 */}
                {searchQuery && searchResults.length === 0 && (
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
            
            {/* 关系模式切换器 */}
            <div style={{
                position: 'absolute',
                top: '30px',
                right: '30px',
                zIndex: 10
            }}>
                <div style={{ ...UI_STYLES.glassCard, padding: '15px 20px' }}>
                    <div style={{ 
                        fontSize: '13px', 
                        color: '#00ccff', 
                        marginBottom: '10px',
                        fontWeight: 'bold'
                    }}>
                        🎯 关系显示模式
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                        <button
                            onClick={() => setDisplayMode('semantic')}
                            style={{
                                padding: '8px 15px',
                                background: displayMode === 'semantic' ? '#00ccff' : 'rgba(255,255,255,0.1)',
                                color: displayMode === 'semantic' ? '#000' : '#fff',
                                border: '1px solid rgba(255,255,255,0.3)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: displayMode === 'semantic' ? 'bold' : 'normal',
                                transition: 'all 0.2s'
                            }}
                            title={`语义关系: 显示用户显式定义的关系 (${relations.length} 个)`}
                        >
                            🌿 语义关系 ({relations.length})
                        </button>
                        <button
                            onClick={() => setDisplayMode('tags')}
                            style={{
                                padding: '8px 15px',
                                background: displayMode === 'tags' ? '#00ccff' : 'rgba(255,255,255,0.1)',
                                color: displayMode === 'tags' ? '#000' : '#fff',
                                border: '1px solid rgba(255,255,255,0.3)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: displayMode === 'tags' ? 'bold' : 'normal',
                                transition: 'all 0.2s'
                            }}
                            title="标签推断: 基于共同标签自动生成连接"
                        >
                            🏷️ 标签推断
                        </button>
                    </div>
                    <div style={{
                        marginTop: '10px',
                        fontSize: '11px',
                        color: '#999',
                        lineHeight: '1.4'
                    }}>
                        💡 当前: <strong style={{ color: '#00ccff' }}>
                            {displayMode === 'semantic' ? '语义关系模式' : '标签推断模式'}
                        </strong>
                        {displayMode === 'semantic' && <><br/>显示用户显式定义的知识关系</>}
                        {displayMode === 'tags' && <><br/>基于共同标签自动推断连接</>}
                    </div>
                </div>
            </div>
            
            {/* 3D 场景中的标签层 */}
            <div 
                ref={labelsContainerRef}
                style={{
                    position: 'absolute',
                    top: 0, left: 0,
                    width: '100%', height: '100%',
                    pointerEvents: 'none', // 确保不阻挡鼠标点击 canvas
                    overflow: 'hidden'
                }}
            >
                {knowledgePoints.map((kp, i) => (
                    <div
                        key={kp._id || i}
                        ref={el => labelsRef.current[i] = el}
                        style={{
                            position: 'absolute',
                            top: 0, left: 0,
                            color: '#aaa',
                            fontSize: '12px',
                            fontFamily: 'Arial, sans-serif',
                            whiteSpace: 'nowrap',
                            userSelect: 'none',
                            pointerEvents: 'none',
                            transition: 'opacity 0.2s, color 0.2s, font-size 0.2s',
                            textShadow: '0 0 2px black',
                            opacity: 0, // 初始不可见，由 animate 控制
                            willChange: 'transform, opacity'
                        }}
                    >
                        {kp.title}
                    </div>
                ))}
            </div>

                <div className="controls-group" style={{
                    display: 'flex',
                    gap: '20px',
                    alignItems: 'center',
                    position: 'absolute',
                    bottom: '30px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10
                }}>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(5px)',
                        padding: '10px 30px',
                        borderRadius: '50px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        fontSize: '13px',
                        color: 'rgba(255, 255, 255, 0.8)',
                        display: 'flex',
                        gap: '20px',
                        boxShadow: '0 5px 20px rgba(0,0,0,0.2)'
                    }}>
                        <span>🖱️ 左键旋转</span>
                        <span>🖱️ 右键平移</span>
                        <span>🔍 滚轮缩放</span>
                        <span>👆 点击星球</span>
                    </div>
                </div>
            
            {/* 详情卡片 */}
            {selectedNodeData && (
                <div style={UI_STYLES.detailCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, fontSize: '22px', color: '#00ccff' }}>
                            🪐 {selectedNodeData.title}
                        </h3>
                        <button
                            onClick={() => {
                                setSelectedNodeData(null);
                                flyBackToOverview();
                            }}
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
                        style={{ lineHeight: '1.8', color: '#ccc', fontSize: '15px' }}
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
                </div>
            )}
        </div>
    );
}

export default KnowledgeUniversePage;
