# 技术设计文档：knowledge-universe-3d

## 1. 概述

### 1.1 功能描述
本功能实现一个基于 Three.js 的 3D 知识宇宙可视化系统，将用户的知识点以星球形式在三维空间中展示，通过力导向布局算法实现自动排列，并支持自动和手动两种方式创建知识点之间的连接关系。

### 1.2 技术栈
- **前端**：React 18 + Vite + Three.js + d3-force-3d + axios
- **后端**：Node.js + Express + MongoDB + Mongoose
- **认证**：JWT（复用现有 AuthContext）

### 1.3 依赖关系
```
新增依赖：
- d3-force-3d@^3.0.0（前端）

现有依赖：
- three@^0.181.2（已安装）
- axios@^1.12.2（已安装）
- react-router-dom@^7.9.4（已安装）
```

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                     前端层 (React)                        │
├─────────────────────────────────────────────────────────┤
│  KnowledgeUniversePage.jsx                              │
│    ├─ 3D场景管理（Three.js）                             │
│    ├─ 力导向布局（d3-force-3d）                           │
│    ├─ 交互控制（Raycaster, OrbitControls）               │
│    └─ UI组件（详情浮层、编辑模式切换）                     │
├─────────────────────────────────────────────────────────┤
│  API 通信层（axios）                                      │
└─────────────────────────────────────────────────────────┘
                            ↓ HTTP/JSON
┌─────────────────────────────────────────────────────────┐
│                    后端层 (Express)                       │
├─────────────────────────────────────────────────────────┤
│  路由层                                                   │
│    ├─ /api/knowledge-points (现有)                       │
│    ├─ /api/relations (新增)                              │
│    └─ /api/graph/knowledge-universe (新增)                │
├─────────────────────────────────────────────────────────┤
│  业务逻辑层                                               │
│    ├─ 关系管理控制器                                       │
│    └─ 图谱数据整合服务                                     │
├─────────────────────────────────────────────────────────┤
│  数据层 (MongoDB + Mongoose)                             │
│    ├─ KnowledgePoint Model (现有)                        │
│    └─ KnowledgeRelation Model (新增)                     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流图

```
用户操作 → 前端事件 → 状态更新 → Three.js渲染
                  ↓
            API调用（创建/删除关系）
                  ↓
            后端验证 → 数据库操作
                  ↓
            响应数据 → 前端更新场景
```

---

## 3. 组件设计

### 3.1 前端组件结构

#### 3.1.1 KnowledgeUniversePage.jsx（主组件）

**职责**：
- 管理 3D 场景的生命周期
- 协调各子系统（渲染、布局、交互、数据）

**状态管理**：
```javascript
// 数据状态
const [knowledgePoints, setKnowledgePoints] = useState([]);
const [relations, setRelations] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

// UI状态
const [editMode, setEditMode] = useState(false);
const [selectedNode, setSelectedNode] = useState(null);
const [showDetailPanel, setShowDetailPanel] = useState(false);

// 拖拽状态
const [dragStart, setDragStart] = useState(null);
const [tempLine, setTempLine] = useState(null);
```

**Refs 管理**：
```javascript
const mountRef = useRef(null);                    // DOM 挂载点
const sceneRef = useRef(null);                    // Three.js Scene
const cameraRef = useRef(null);                   // Camera
const rendererRef = useRef(null);                 // Renderer
const controlsRef = useRef(null);                 // OrbitControls
const raycasterRef = useRef(new THREE.Raycaster());
const mouseRef = useRef(new THREE.Vector2());
const simulationRef = useRef(null);               // d3-force-3d 模拟器
const nodeObjectsRef = useRef(new Map());         // nodeId -> Mesh 映射
const lineObjectsRef = useRef(new Map());         // relationId -> Line 映射
```

**生命周期钩子**：
```javascript
// 1. 数据获取
useEffect(() => {
  fetchKnowledgePoints();
  fetchRelations();
}, []);

// 2. 场景初始化
useEffect(() => {
  if (knowledgePoints.length > 0) {
    initThreeScene();
    return cleanup;
  }
}, [knowledgePoints, relations]);

// 3. 编辑模式切换
useEffect(() => {
  if (editMode) {
    enableEditInteractions();
  } else {
    disableEditInteractions();
  }
}, [editMode]);
```

#### 3.1.2 详情浮层组件（NodeDetailPanel）

**Props**：
```javascript
{
  node: {
    _id: string,
    title: string,
    content: string,
    category: string,
    tags: string[],
    createdAt: Date
  },
  visible: boolean,
  onClose: () => void
}
```

**样式定位**：
- 固定在右下角（position: fixed, right: 20px, bottom: 20px）
- 宽度：300px，最大高度：500px
- 带有阴影、圆角和模糊背景（backdrop-filter）

#### 3.1.3 编辑模式控制栏（EditModeToolbar）

**功能**：
- 切换编辑/浏览模式
- 显示当前模式状态
- 提供操作提示

**位置**：右上角（position: fixed, right: 20px, top: 80px）

---

### 3.2 后端组件结构

#### 3.2.1 数据模型

##### KnowledgeRelation Model
```javascript
// models/KnowledgeRelation.js
const KnowledgeRelationSchema = new mongoose.Schema({
  source: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KnowledgePoint',
    required: true,
    index: true
  },
  target: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KnowledgePoint',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['auto', 'manual'],
    default: 'manual',
    required: true
  },
  relationLabel: {
    type: String,
    trim: true,
    maxlength: 50
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, { 
  timestamps: true 
});

// 复合索引：防止重复关系
KnowledgeRelationSchema.index({ 
  source: 1, 
  target: 1, 
  author: 1 
}, { unique: true });

// 虚拟字段：双向查询
KnowledgeRelationSchema.index({ author: 1, source: 1 });
KnowledgeRelationSchema.index({ author: 1, target: 1 });
```

#### 3.2.2 路由设计

##### /api/relations（新增）
```javascript
// routes/knowledgeRelations.js

// 创建关系
POST /api/relations
Body: { source: ObjectId, target: ObjectId, relationLabel?: string }
Response: { _id, source, target, type: 'manual', relationLabel, author, createdAt }

// 获取用户所有关系
GET /api/relations
Response: [{ _id, source, target, type, relationLabel, createdAt }]

// 删除关系
DELETE /api/relations/:id
Response: { msg: 'Relation removed' }
```

##### /api/graph/knowledge-universe（新增）
```javascript
// routes/graph.js - 新增端点

// 获取3D知识宇宙数据（整合自动+手动关系）
GET /api/graph/knowledge-universe
Response: {
  nodes: [{
    id: string,
    title: string,
    content: string,
    category: string,
    tags: string[],
    createdAt: Date
  }],
  links: [{
    source: string,
    target: string,
    type: 'auto' | 'manual',
    relationLabel?: string,
    _id?: string  // 手动关系包含ID用于删除
  }]
}
```

#### 3.2.3 控制器逻辑

##### 关系管理控制器
```javascript
// controllers/knowledgeRelationsController.js

exports.createRelation = async (req, res) => {
  // 1. 验证参数
  // 2. 检查是否自关联（source === target）
  // 3. 检查是否重复（查询数据库）
  // 4. 验证 source 和 target 是否存在且属于当前用户
  // 5. 创建关系记录
  // 6. 返回完整数据
};

exports.getRelations = async (req, res) => {
  // 查询当前用户的所有关系
};

exports.deleteRelation = async (req, res) => {
  // 1. 查找关系
  // 2. 验证所有权
  // 3. 删除
};
```

##### 图谱整合服务
```javascript
// services/graphIntegrationService.js

exports.getKnowledgeUniverseData = async (userId) => {
  // 1. 查询用户所有知识点
  const knowledgePoints = await KnowledgePoint.find({ author: userId });
  
  // 2. 计算自动关系（基于 category 和 tags）
  const autoLinks = calculateAutoLinks(knowledgePoints);
  
  // 3. 查询手动关系
  const manualRelations = await KnowledgeRelation.find({ author: userId });
  const manualLinks = manualRelations.map(r => ({
    source: r.source.toString(),
    target: r.target.toString(),
    type: 'manual',
    relationLabel: r.relationLabel,
    _id: r._id.toString()
  }));
  
  // 4. 合并并去重
  const links = [...autoLinks, ...manualLinks];
  
  return {
    nodes: knowledgePoints.map(formatNode),
    links: links
  };
};

function calculateAutoLinks(knowledgePoints) {
  const links = [];
  
  // 规则1：相同 category
  const categoryGroups = groupBy(knowledgePoints, 'category');
  for (const [category, nodes] of Object.entries(categoryGroups)) {
    if (nodes.length > 1) {
      // 在组内创建连接（避免完全图，只连接相邻节点）
      for (let i = 0; i < nodes.length - 1; i++) {
        links.push({
          source: nodes[i]._id.toString(),
          target: nodes[i + 1]._id.toString(),
          type: 'auto'
        });
      }
    }
  }
  
  // 规则2：共享 tag
  for (let i = 0; i < knowledgePoints.length; i++) {
    for (let j = i + 1; j < knowledgePoints.length; j++) {
      const kp1 = knowledgePoints[i];
      const kp2 = knowledgePoints[j];
      const sharedTags = kp1.tags.filter(tag => kp2.tags.includes(tag));
      if (sharedTags.length > 0) {
        links.push({
          source: kp1._id.toString(),
          target: kp2._id.toString(),
          type: 'auto'
        });
      }
    }
  }
  
  // 去重
  return Array.from(
    new Map(links.map(link => [`${link.source}-${link.target}`, link])).values()
  );
}
```

---

## 4. 数据模型详细设计

### 4.1 前端数据结构

#### 节点数据（Node）
```typescript
interface Node {
  _id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: Date;
}
```

#### 关系数据（Link）
```typescript
interface Link {
  source: string;        // 节点ID
  target: string;        // 节点ID
  type: 'auto' | 'manual';
  relationLabel?: string;
  _id?: string;          // 手动关系才有
}
```

#### 力导向模拟数据（ForceNode）
```typescript
interface ForceNode {
  id: string;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
}
```

### 4.2 Three.js 对象结构

#### 球体节点（Mesh）
```javascript
const sphere = new THREE.Mesh(geometry, material);
sphere.userData = {
  id: node._id,
  title: node.title,
  content: node.content,
  category: node.category,
  originalColor: color,
  originalEmissive: emissiveColor
};
```

#### 连线（Line）
```javascript
const line = new THREE.Line(geometry, material);
line.userData = {
  relationId: link._id || `auto-${link.source}-${link.target}`,
  source: link.source,
  target: link.target,
  type: link.type
};
```

---

## 5. 关键算法与逻辑

### 5.1 力导向布局集成

```javascript
import * as d3 from 'd3-force-3d';

function initForceSimulation(nodes, links) {
  // 1. 准备数据格式
  const forceNodes = nodes.map(node => ({ id: node._id }));
  const forceLinks = links.map(link => ({
    source: link.source,
    target: link.target
  }));
  
  // 2. 创建模拟器
  const simulation = d3.forceSimulation(forceNodes, 3)
    .force('charge', d3.forceManyBody().strength(-50))
    .force('center', d3.forceCenter(0, 0, 0))
    .force('link', d3.forceLink(forceLinks).id(d => d.id).distance(50))
    .force('collision', d3.forceCollide().radius(10));
  
  // 3. 在动画循环中更新
  function updatePositions() {
    simulation.tick();
    
    forceNodes.forEach(d => {
      const mesh = nodeObjectsRef.current.get(d.id);
      if (mesh) {
        mesh.position.set(d.x || 0, d.y || 0, d.z || 0);
      }
    });
    
    updateLinePositions();
  }
  
  return { simulation, updatePositions };
}
```

### 5.2 鼠标交互 - Raycaster

```javascript
function handleMouseMove(event) {
  const rect = mountRef.current.getBoundingClientRect();
  mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function detectHover() {
  raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
  const spheres = Array.from(nodeObjectsRef.current.values());
  const intersects = raycasterRef.current.intersectObjects(spheres);
  
  if (intersects.length > 0) {
    const hoveredMesh = intersects[0].object;
    highlightNode(hoveredMesh);
  } else {
    resetHighlight();
  }
}
```

### 5.3 拖拽创建连线

```javascript
function handleMouseDown(event) {
  if (!editMode) return;
  
  raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
  const spheres = Array.from(nodeObjectsRef.current.values());
  const intersects = raycasterRef.current.intersectObjects(spheres);
  
  if (intersects.length > 0) {
    const mesh = intersects[0].object;
    setDragStart({
      nodeId: mesh.userData.id,
      position: mesh.position.clone()
    });
    
    // 创建临时线条
    const tempLineGeometry = new THREE.BufferGeometry();
    const tempLineMaterial = new THREE.LineBasicMaterial({ 
      color: 0xffff00, 
      opacity: 0.5, 
      transparent: true 
    });
    const tempLineObj = new THREE.Line(tempLineGeometry, tempLineMaterial);
    sceneRef.current.add(tempLineObj);
    setTempLine(tempLineObj);
  }
}

function handleMouseMove(event) {
  if (dragStart && tempLine) {
    // 更新临时线条的终点为鼠标位置
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersectionPoint = raycasterRef.current.ray.at(50, new THREE.Vector3());
    
    const positions = new Float32Array([
      dragStart.position.x, dragStart.position.y, dragStart.position.z,
      intersectionPoint.x, intersectionPoint.y, intersectionPoint.z
    ]);
    tempLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  }
}

async function handleMouseUp(event) {
  if (!dragStart || !tempLine) return;
  
  raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
  const spheres = Array.from(nodeObjectsRef.current.values());
  const intersects = raycasterRef.current.intersectObjects(spheres);
  
  if (intersects.length > 0) {
    const targetMesh = intersects[0].object;
    const targetId = targetMesh.userData.id;
    
    if (targetId !== dragStart.nodeId) {
      // 创建关系
      try {
        const response = await apiClient.post('/relations', {
          source: dragStart.nodeId,
          target: targetId
        });
        
        // 添加到场景
        addLineToScene(response.data);
        setRelations(prev => [...prev, response.data]);
      } catch (error) {
        console.error('创建关系失败', error);
        alert(error.response?.data?.msg || '创建关系失败');
      }
    }
  }
  
  // 清理临时线条
  sceneRef.current.remove(tempLine);
  tempLine.geometry.dispose();
  tempLine.material.dispose();
  setDragStart(null);
  setTempLine(null);
}
```

### 5.4 连线删除逻辑

```javascript
function handleLineRightClick(event) {
  if (!editMode) return;
  
  event.preventDefault();
  
  raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
  const lines = Array.from(lineObjectsRef.current.values());
  const intersects = raycasterRef.current.intersectObjects(lines);
  
  if (intersects.length > 0) {
    const lineObj = intersects[0].object;
    const relationId = lineObj.userData.relationId;
    const type = lineObj.userData.type;
    
    if (type === 'manual') {
      if (confirm('确定删除这条连线吗？')) {
        deleteRelation(relationId, lineObj);
      }
    } else {
      alert('自动生成的连线不能删除');
    }
  }
}

async function deleteRelation(relationId, lineObj) {
  try {
    await apiClient.delete(`/relations/${relationId}`);
    
    // 从场景中移除
    sceneRef.current.remove(lineObj);
    lineObj.geometry.dispose();
    lineObj.material.dispose();
    lineObjectsRef.current.delete(relationId);
    
    // 从状态中移除
    setRelations(prev => prev.filter(r => r._id !== relationId));
  } catch (error) {
    console.error('删除关系失败', error);
    alert('删除关系失败');
  }
}
```

---

## 6. 接口设计

### 6.1 前端 API 调用

```javascript
// 获取知识点
const fetchKnowledgePoints = async () => {
  try {
    const response = await apiClient.get('/knowledge-points');
    setKnowledgePoints(response.data);
  } catch (error) {
    setError('加载知识点失败');
  }
};

// 获取关系
const fetchRelations = async () => {
  try {
    const response = await apiClient.get('/relations');
    setRelations(response.data);
  } catch (error) {
    console.error('加载关系失败', error);
  }
};

// 或者使用整合接口
const fetchUniverseData = async () => {
  try {
    const response = await apiClient.get('/graph/knowledge-universe');
    setKnowledgePoints(response.data.nodes);
    // 将 links 转换为 relations 格式
    const manualRelations = response.data.links
      .filter(link => link.type === 'manual')
      .map(link => ({
        _id: link._id,
        source: link.source,
        target: link.target,
        type: link.type,
        relationLabel: link.relationLabel
      }));
    setRelations(manualRelations);
    // 自动关系直接用于渲染，不保存到状态
  } catch (error) {
    setError('加载数据失败');
  }
};
```

### 6.2 后端 API 实现

#### 路由注册
```javascript
// index.js
app.use('/api/relations', require('./routes/knowledgeRelations'));
```

#### 路由实现
```javascript
// routes/knowledgeRelations.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createRelation,
  getRelations,
  deleteRelation
} = require('../controllers/knowledgeRelationsController');

router.post('/', auth, createRelation);
router.get('/', auth, getRelations);
router.delete('/:id', auth, deleteRelation);

module.exports = router;
```

#### 控制器实现
```javascript
// controllers/knowledgeRelationsController.js
const KnowledgeRelation = require('../models/KnowledgeRelation');
const KnowledgePoint = require('../models/KnowledgePoint');

exports.createRelation = async (req, res) => {
  try {
    const { source, target, relationLabel } = req.body;
    const userId = req.user.id;
    
    // 验证参数
    if (!source || !target) {
      return res.status(400).json({ msg: '缺少必要参数' });
    }
    
    // 检查自关联
    if (source === target) {
      return res.status(400).json({ msg: '不能关联自己' });
    }
    
    // 验证节点存在且属于当前用户
    const [sourceNode, targetNode] = await Promise.all([
      KnowledgePoint.findOne({ _id: source, author: userId }),
      KnowledgePoint.findOne({ _id: target, author: userId })
    ]);
    
    if (!sourceNode || !targetNode) {
      return res.status(404).json({ msg: '知识点不存在或无权访问' });
    }
    
    // 检查重复
    const existing = await KnowledgeRelation.findOne({
      source, target, author: userId
    });
    
    if (existing) {
      return res.status(409).json({ msg: '关系已存在' });
    }
    
    // 创建关系
    const relation = new KnowledgeRelation({
      source,
      target,
      type: 'manual',
      relationLabel: relationLabel || '',
      author: userId
    });
    
    await relation.save();
    res.json(relation);
  } catch (error) {
    console.error('创建关系失败:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.getRelations = async (req, res) => {
  try {
    const relations = await KnowledgeRelation.find({ 
      author: req.user.id 
    }).sort({ createdAt: -1 });
    
    res.json(relations);
  } catch (error) {
    console.error('获取关系失败:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
};

exports.deleteRelation = async (req, res) => {
  try {
    const relation = await KnowledgeRelation.findById(req.params.id);
    
    if (!relation) {
      return res.status(404).json({ msg: '关系不存在' });
    }
    
    if (relation.author.toString() !== req.user.id) {
      return res.status(401).json({ msg: '无权删除' });
    }
    
    await KnowledgeRelation.findByIdAndDelete(req.params.id);
    res.json({ msg: '关系已删除' });
  } catch (error) {
    console.error('删除关系失败:', error);
    res.status(500).json({ msg: 'Server Error' });
  }
};
```

---

## 7. 错误处理策略

### 7.1 前端错误处理

```javascript
// 全局错误边界
const ErrorBoundary = ({ error, resetError }) => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    <h2>😢 出错了</h2>
    <p>{error?.message || '发生未知错误'}</p>
    <button onClick={resetError}>重试</button>
  </div>
);

// API 错误处理
const handleApiError = (error, context) => {
  const message = error.response?.data?.msg || error.message || '操作失败';
  console.error(`${context}:`, error);
  
  if (error.response?.status === 401) {
    // 认证失败，跳转登录
    window.location.href = '/login';
  } else if (error.response?.status === 409) {
    // 冲突错误（如重复创建关系）
    alert(message);
  } else {
    setError(message);
  }
};

// WebGL 支持检测
const checkWebGLSupport = () => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      throw new Error('WebGL not supported');
    }
  } catch (e) {
    setError('您的浏览器不支持 WebGL，请升级浏览器');
    return false;
  }
  return true;
};
```

### 7.2 后端错误处理

```javascript
// 统一错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({ msg: '数据验证失败', errors: err.errors });
  }
  
  if (err.name === 'MongoError' && err.code === 11000) {
    return res.status(409).json({ msg: '数据已存在' });
  }
  
  res.status(500).json({ msg: 'Server Error' });
});
```

---

## 8. 性能优化策略

### 8.1 Three.js 性能优化

```javascript
// 1. 使用 BufferGeometry 批量渲染
const geometryCache = new THREE.SphereGeometry(0.8, 32, 32);

// 2. 共享材质
const materialCache = new Map();
function getMaterial(color) {
  if (!materialCache.has(color)) {
    materialCache.set(color, new THREE.MeshStandardMaterial({ color }));
  }
  return materialCache.get(color);
}

// 3. 降低力模拟频率
let frameCount = 0;
function animate() {
  requestAnimationFrame(animate);
  
  frameCount++;
  if (frameCount % 5 === 0 && simulationRef.current.alpha() > 0.01) {
    updateForceLayout();
  }
  
  detectHover();
  controlsRef.current.update();
  rendererRef.current.render(sceneRef.current, cameraRef.current);
}

// 4. 防抖 Raycaster 检测
const debouncedDetectHover = debounce(detectHover, 50);

// 5. 限制连线数量
const MAX_AUTO_LINKS = 500;
function limitLinks(links) {
  if (links.length > MAX_AUTO_LINKS) {
    return links.slice(0, MAX_AUTO_LINKS);
  }
  return links;
}
```

### 8.2 数据查询优化

```javascript
// 后端：使用索引和投影
const relations = await KnowledgeRelation
  .find({ author: userId })
  .select('source target type relationLabel')
  .lean()  // 返回普通 JS 对象，不是 Mongoose Document
  .exec();

// 使用聚合管道优化复杂查询
const universeData = await KnowledgePoint.aggregate([
  { $match: { author: userId } },
  { $lookup: {
    from: 'knowledgerelations',
    let: { kpId: '$_id' },
    pipeline: [
      { $match: {
        $expr: { $or: [
          { $eq: ['$source', '$$kpId'] },
          { $eq: ['$target', '$$kpId'] }
        ]}
      }}
    ],
    as: 'relations'
  }}
]);
```

---

## 9. 测试策略

### 9.1 单元测试

#### 前端测试（使用 Vitest + React Testing Library）
```javascript
// tests/KnowledgeUniversePage.test.jsx
describe('KnowledgeUniversePage', () => {
  test('应该渲染加载状态', () => {
    render(<KnowledgeUniversePage />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });
  
  test('应该渲染错误状态', async () => {
    apiClient.get.mockRejectedValue(new Error('Network error'));
    render(<KnowledgeUniversePage />);
    await waitFor(() => {
      expect(screen.getByText(/加载失败/i)).toBeInTheDocument();
    });
  });
});

// tests/forceLayout.test.js
describe('力导向布局', () => {
  test('应该正确初始化模拟器', () => {
    const nodes = [{ id: '1' }, { id: '2' }];
    const links = [{ source: '1', target: '2' }];
    const simulation = initForceSimulation(nodes, links);
    expect(simulation).toBeDefined();
  });
});
```

#### 后端测试（使用 Jest + Supertest）
```javascript
// tests/relations.test.js
describe('POST /api/relations', () => {
  test('应该创建新关系', async () => {
    const response = await request(app)
      .post('/api/relations')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: nodeId1, target: nodeId2 })
      .expect(200);
    
    expect(response.body).toHaveProperty('_id');
    expect(response.body.type).toBe('manual');
  });
  
  test('应该拒绝重复关系', async () => {
    await request(app)
      .post('/api/relations')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: nodeId1, target: nodeId2 });
    
    const response = await request(app)
      .post('/api/relations')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: nodeId1, target: nodeId2 })
      .expect(409);
    
    expect(response.body.msg).toMatch(/已存在/);
  });
});
```

### 9.2 集成测试

```javascript
// tests/integration/knowledge-universe.test.js
describe('知识宇宙功能集成测试', () => {
  test('完整工作流：加载 -> 创建连线 -> 删除连线', async () => {
    // 1. 登录
    const loginRes = await request(app).post('/api/users/login')...
    
    // 2. 创建知识点
    const kp1 = await createKnowledgePoint(token, { title: 'Node1' });
    const kp2 = await createKnowledgePoint(token, { title: 'Node2' });
    
    // 3. 创建关系
    const relation = await request(app)
      .post('/api/relations')
      .set('Authorization', `Bearer ${token}`)
      .send({ source: kp1._id, target: kp2._id })
      .expect(200);
    
    // 4. 获取图谱数据
    const graphData = await request(app)
      .get('/api/graph/knowledge-universe')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(graphData.body.nodes).toHaveLength(2);
    expect(graphData.body.links).toContainEqual(
      expect.objectContaining({ source: kp1._id.toString(), target: kp2._id.toString() })
    );
    
    // 5. 删除关系
    await request(app)
      .delete(`/api/relations/${relation.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
```

### 9.3 E2E 测试（可选）

使用 Playwright 或 Cypress 进行端到端测试。

---

## 10. 部署与运维

### 10.1 环境变量配置

```bash
# .env
MONGO_URI=mongodb://localhost:27017/feynman-platform
JWT_SECRET=your-secret-key
PORT=3000
```

### 10.2 依赖安装

```bash
# 前端
cd feynman-platform-frontend
npm install d3-force-3d

# 后端
cd feynman-platform-backend
npm install  # 无新增依赖
```

### 10.3 数据库迁移

首次部署需要创建索引：

```javascript
// 在 MongoDB shell 或通过脚本执行
db.knowledgerelations.createIndex({ source: 1, target: 1, author: 1 }, { unique: true });
db.knowledgerelations.createIndex({ author: 1, source: 1 });
db.knowledgerelations.createIndex({ author: 1, target: 1 });
```

---

## 11. 技术决策与权衡

### 11.1 为什么选择 d3-force-3d？
- **优点**：成熟的力导向算法、社区支持好、API 简洁
- **缺点**：需要额外依赖
- **替代方案**：手写简单物理引擎（更轻量但开发成本高）

### 11.2 为什么独立的 KnowledgeRelation 表？
- **优点**：数据结构清晰、易于查询、可扩展
- **缺点**：多一次数据库查询
- **权衡**：可通过缓存或聚合查询优化性能

### 11.3 为什么不使用 CesiumJS？
- 课程文档标题提到 CesiumJS，但 CesiumJS 是地理空间可视化引擎（主要用于地球、地图）
- Three.js 更适合通用 3D 场景、性能更好、学习曲线更平缓
- 建议保持使用 Three.js

---

## 12. 未来扩展方向

### 12.1 功能扩展
- 关系类型标签（依赖、扩展、引用等）
- 节点搜索与筛选
- 导出为图片/视频
- VR/AR 支持

### 12.2 性能扩展
- 使用 Web Worker 进行力模拟计算
- 实现 LOD（Level of Detail）机制
- 虚拟化渲染（只渲染可见区域）

### 12.3 数据扩展
- 支持协作编辑（多用户共享知识图谱）
- 版本控制（关系历史记录）
- AI 推荐关系（基于语义相似度）

---

## 附录

### A. 参考资料
- Three.js 官方文档：https://threejs.org/docs/
- d3-force-3d GitHub：https://github.com/vasturiano/d3-force-3d
- React Three Fiber（未来可考虑）：https://docs.pmnd.rs/react-three-fiber

### B. 颜色方案
```javascript
// 节点颜色（按 category 分配）
const categoryColors = {
  '数学': 0x4facfe,
  '物理': 0xfa709a,
  '化学': 0x43e97b,
  '编程': 0xfee140,
  'default': 0xa8a8a8
};

// 连线颜色
const linkColors = {
  auto: 0x00d4ff,    // 蓝色
  manual: 0xffff00   // 黄色
};
```

### C. 快捷键设计
```javascript
const shortcuts = {
  'E': '切换编辑模式',
  'Escape': '退出编辑模式/关闭详情面板',
  'Space': '暂停/恢复力模拟',
  'R': '重置相机位置'
};
```
