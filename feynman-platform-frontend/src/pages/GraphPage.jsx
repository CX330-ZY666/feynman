// src/pages/GraphPage.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import * as d3 from 'd3-force';
import apiClient from '../api/axios';
import './GraphPage.css';

// 节点状态对应的颜色
const NODE_COLOR_MASTERED = '#22c55e';
const NODE_COLOR_REVIEW = '#f97316';
const NODE_COLOR_DEFAULT = '#3b82f6';

// 难度级别映射
const difficultyMap = {
  beginner: '初级',
  intermediate: '中级',
  advanced: '高级'
};

// 关系类型映射
const relationTypeMap = {
  prerequisite: '前置知识',
  derived: '派生',
  similar: '相似',
  contrast: '对比',
  application: '应用',
  includes: '包含',
  reference: '引用'
};

function getNodeColor(node) {
  if (node.status === 'mastered') return NODE_COLOR_MASTERED;
  if (node.status === 'reviewing' || node.reviewList) return NODE_COLOR_REVIEW;
  return NODE_COLOR_DEFAULT;
}

function getStatusText(node) {
  if (node.status === 'mastered') return '已掌握';
  if (node.status === 'reviewing' || node.reviewList) return '需复习';
  return '学习中';
}

function formatDate(value) {
  try {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('zh-CN');
  } catch {
    return '-';
  }
}

function buildAdjacency(links) {
  const map = new Map();
  const add = (a, b) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a).add(b);
  };
  links.forEach((l) => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    if (!s || !t) return;
    add(s, t);
    add(t, s);
  });
  return map;
}

function applyFocusStyle(baseNodes, baseLinks, selectedId, adjacency, showAllEdgeLabels) {
  const hasSelection = Boolean(selectedId);

  if (!hasSelection) {
    return {
      nodes: baseNodes.map((n) => ({
        ...n,
        label: { show: true },
        itemStyle: { ...(n.itemStyle || {}), opacity: 1 }
      })),
      links: baseLinks.map((l) => ({
        ...l,
        lineStyle: { ...(l.lineStyle || {}), opacity: 0.8, width: 1.5 }, // 加深默认连线
        label: { ...(l.label || {}), show: Boolean(showAllEdgeLabels) }
      }))
    };
  }

  const neighbors = new Set([selectedId]);
  const nb = adjacency.get(selectedId);
  if (nb) nb.forEach((x) => neighbors.add(x));

  const nodes = baseNodes.map((n) => {
    const inFocus = neighbors.has(n.id);
    const isSelected = n.id === selectedId;
    const baseSize = n.__baseSymbolSize || n.symbolSize || 24;
    const nextSize = isSelected ? Math.round(baseSize * 1.25) : baseSize;

    return {
      ...n,
      symbolSize: nextSize,
      itemStyle: {
        ...(n.itemStyle || {}),
        opacity: inFocus ? 1 : 0.1,
        shadowBlur: isSelected ? 20 : 0
      },
      label: {
        show: inFocus
      }
    };
  });

  const links = baseLinks.map((l) => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    const isRelevant = s === selectedId || t === selectedId;

    return {
      ...l,
      lineStyle: { ...(l.lineStyle || {}), opacity: isRelevant ? 0.8 : 0.05, width: isRelevant ? 2 : 1 },
      label: showAllEdgeLabels
        ? { ...(l.label || {}), show: true }
        : { ...(l.label || {}), show: isRelevant }
    };
  });

  return { nodes, links };
}

function buildChartOption(nodes, links, showAllEdgeLabels, hasSelection) {
  return {
    backgroundColor: 'transparent',
    animationDuration: 600,
    animationEasingUpdate: 'cubicOut',
    tooltip: {
      show: false // We use the side panel for details now
    },
    series: [
      {
        type: 'graph',
        layout: 'none',
        data: nodes,
        links,
        roam: true,
        draggable: true,
        cursor: 'pointer',
        label: {
          show: true,
          position: 'bottom',
          formatter: '{b}',
          fontSize: 12,
          color: '#374151',
          fontFamily: 'sans-serif',
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderColor: 'transparent',
          borderRadius: 4,
          padding: [2, 4],
          distance: 6
        },
        edgeLabel: {
          show: Boolean(showAllEdgeLabels || hasSelection),
          fontSize: 10,
          color: '#6b7280',
          formatter: (params) => params.data?.relationLabelText || ''
        },
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: [0, 8],
        lineStyle: {
          color: '#64748b', // 加深连线颜色 (slate-500)
          curveness: 0.15,
          width: 1.5,
          opacity: 0.7
        },
        emphasis: {
          focus: 'adjacency',
          scale: 1.1,
          lineStyle: {
            width: 3,
            opacity: 1
          }
        }
      }
    ]
  };
}

function GraphPage() {
  const navigate = useNavigate();
  const chartInstanceRef = useRef(null);

  const [baseGraph, setBaseGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [showAllEdgeLabels, setShowAllEdgeLabels] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chartKey, setChartKey] = useState(0);

  // Fetch Data (Keep same logic)
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await apiClient.get('/graph/knowledge-map');
        const graphData = response.data;

        if (!graphData?.nodes || graphData.nodes.length === 0) {
          setBaseGraph({ nodes: [], links: [], adjacency: new Map() });
          return;
        }

        // d3-force Pre-calculation
        const simulationNodes = graphData.nodes.map((node, i) => {
          const baseSize = Math.round((node.symbolSize || 24) * 1.4);
          const normalizedId = String(node.id || node._id || i);
          return {
            ...node,
            id: normalizedId,
            index: i,
            __baseSymbolSize: baseSize,
            radius: baseSize / 2 + 10 // Increased radius buffer
          };
        });

        const nodeIdSet = new Set(simulationNodes.map((n) => n.id));

        const simulationLinks = (graphData.links || [])
          .map((link) => {
            const sourceRaw = typeof link.source === 'object' ? link.source.id : link.source;
            const targetRaw = typeof link.target === 'object' ? link.target.id : link.target;
            return {
              source: String(sourceRaw || ''),
              target: String(targetRaw || '')
            };
          })
          .filter((link) => nodeIdSet.has(link.source) && nodeIdSet.has(link.target));

        const simulation = d3
          .forceSimulation(simulationNodes)
          .force('charge', d3.forceManyBody().strength(-1200)) // 增强排斥力，让节点更分散
          .force('center', d3.forceCenter(0, 0))
          .force('link', d3.forceLink(simulationLinks).id((d) => d.id).distance(250).strength(0.3)) // 增加连线距离
          .force('collision', d3.forceCollide().radius((d) => d.radius * 1.5).strength(1).iterations(4)) // 增大碰撞半径
          .stop();

        for (let i = 0; i < 300; i++) simulation.tick();

        const processedNodes = simulationNodes.map((node) => ({
          ...node,
          x: node.x,
          y: node.y,
          symbolSize: node.__baseSymbolSize,
          itemStyle: {
            color: getNodeColor(node),
            borderColor: '#fff',
            borderWidth: 2,
            shadowColor: 'rgba(0,0,0,0.1)',
            shadowBlur: 5
          }
        }));

        const processedLinks = (graphData.links || [])
          .map((link) => {
            const sourceRaw = typeof link.source === 'object' ? link.source.id : link.source;
            const targetRaw = typeof link.target === 'object' ? link.target.id : link.target;
            return {
              ...link,
              source: String(sourceRaw || ''),
              target: String(targetRaw || ''),
              relationLabelText: link.relationType ? (relationTypeMap[link.relationType] || link.relationLabel || '关系') : '引用'
            };
          })
          .filter((link) => nodeIdSet.has(link.source) && nodeIdSet.has(link.target));

        const adjacency = buildAdjacency(processedLinks);
        setBaseGraph({ nodes: processedNodes, links: processedLinks, adjacency });
      } catch (e) {
        console.error('获取图谱数据失败', e);
        setError('获取图谱数据失败，请稍后重试');
        setBaseGraph(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Memos
  const stats = useMemo(() => ({
    nodeCount: baseGraph?.nodes?.length || 0,
    linkCount: baseGraph?.links?.length || 0
  }), [baseGraph]);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !baseGraph?.nodes?.length) return [];
    return baseGraph.nodes.filter((n) => (n.name || '').toLowerCase().includes(q)).slice(0, 8);
  }, [searchQuery, baseGraph]);

  const selectedNode = useMemo(() => {
    if (!selectedId || !baseGraph?.nodes?.length) return null;
    return baseGraph.nodes.find((n) => n.id === selectedId) || null;
  }, [selectedId, baseGraph]);

  const option = useMemo(() => {
    if (!baseGraph) return null;
    const { nodes, links, adjacency } = baseGraph;
    const styled = applyFocusStyle(nodes, links, selectedId, adjacency, showAllEdgeLabels);
    return buildChartOption(styled.nodes, styled.links, showAllEdgeLabels, Boolean(selectedId));
  }, [baseGraph, selectedId, showAllEdgeLabels]);

  // Handlers
  const onChartClick = (params) => {
    if (params.componentType === 'series' && params.dataType === 'node') {
      setSelectedId(params.data.id);
    }
  };

  const onChartReady = (instance) => {
    chartInstanceRef.current = instance;
    instance.getZr().on('click', (params) => {
      // If clicked on blank area (no target), clear selection
      if (!params.target) {
        setSelectedId(null);
      }
    });
    instance.on('click', onChartClick);
  };

  const handleResetView = () => {
    setSelectedId(null);
    setSearchQuery('');
    setChartKey((k) => k + 1);
  };

  const handlePickNode = (id) => {
    setSelectedId(id);
    setSearchQuery('');
  };

  // Render
  if (loading) {
    return (
      <div className="graph-page-container">
        <div className="graph-loading-overlay">
          <div className="loading-spinner"></div>
          <div>正在编织知识网络...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="graph-page-container">
        <div className="graph-empty-overlay">
           <div className="empty-icon">❌</div>
           <h3>{error}</h3>
        </div>
      </div>
    );
  }

  const isEmpty = !baseGraph || baseGraph.nodes.length === 0;

  return (
    <div className="graph-page-container">
      {/* 1. Canvas Layer */}
      <div className="graph-canvas-layer">
        {isEmpty ? (
           <div className="graph-empty-overlay">
             <div className="empty-icon">🕸️</div>
             <h2>还没有知识节点</h2>
             <p style={{ color: '#6b7280', margin: '12px 0 24px' }}>
               创建第一个知识点，即可开启你的知识图谱之旅。
             </p>
             <button className="graph-btn graph-btn-primary" onClick={() => navigate('/kp/new')}>
               ✨ 创建知识点
             </button>
           </div>
        ) : (
          <ReactECharts
            key={chartKey}
            option={option}
            style={{ height: '100%', width: '100%' }}
            onChartReady={onChartReady}
            opts={{ renderer: 'canvas' }}
          />
        )}
      </div>

      {/* 2. UI Layer */}
      {!isEmpty && (
        <div className="graph-ui-layer">
          {/* Top Bar */}
          <header className="graph-floating-header graph-glass-panel">
            <div className="graph-header-left">
              <div className="graph-title">
                <span>🔗</span> 知识图谱
              </div>
              <div className="graph-stats-pill">
                <span>节点 <b>{stats.nodeCount}</b></span>
                <span>连线 <b>{stats.linkCount}</b></span>
              </div>
            </div>

            <div className="graph-search-container">
              <span className="graph-search-icon">🔍</span>
              <input 
                className="graph-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索知识点..."
              />
              {searchQuery && (
                <button className="graph-search-clear" onClick={() => setSearchQuery('')}>×</button>
              )}
              {searchResults.length > 0 && (
                <div className="graph-search-dropdown">
                  {searchResults.map((n) => (
                    <button key={n.id} className="graph-search-item" onClick={() => handlePickNode(n.id)}>
                      <span style={{ fontWeight: 500 }}>{n.name}</span>
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{getStatusText(n)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="graph-header-actions">
              <button className="graph-btn graph-btn-secondary" onClick={handleResetView}>
                重置视图
              </button>
              <button className="graph-btn graph-btn-primary" onClick={() => navigate('/kp/new')}>
                + 新建
              </button>
            </div>
          </header>

          {/* Legend (Bottom Left) */}
          <div className="graph-floating-legend graph-glass-panel">
            <div className="legend-title">节点状态</div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: NODE_COLOR_MASTERED }}></span>
              <span>已掌握 (Mastered)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: NODE_COLOR_REVIEW }}></span>
              <span>需复习 (Review)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: NODE_COLOR_DEFAULT }}></span>
              <span>学习中 (Learning)</span>
            </div>
          </div>

          {/* Inspector (Right Side) */}
          <aside className={`graph-inspector-panel graph-glass-panel ${selectedId ? 'open' : ''}`}>
             {selectedNode ? (
               <>
                 <div className="inspector-header">
                   <div className="inspector-title">{selectedNode.name}</div>
                   <button className="inspector-close" onClick={() => setSelectedId(null)}>×</button>
                 </div>
                 
                 <div className="inspector-meta">
                   <div className="meta-row">
                     <span>状态</span>
                     <span className="meta-val" style={{ color: getNodeColor(selectedNode) }}>
                       {getStatusText(selectedNode)}
                     </span>
                   </div>
                   <div className="meta-row">
                     <span>难度</span>
                     <span className="meta-val">{difficultyMap[selectedNode.difficulty] || '一般'}</span>
                   </div>
                   <div className="meta-row">
                     <span>创建时间</span>
                     <span className="meta-val">{formatDate(selectedNode.createdAt)}</span>
                   </div>
                 </div>

                 {selectedNode.value && (
                   <div className="inspector-desc">
                     {String(selectedNode.value).substring(0, 150)}
                     {String(selectedNode.value).length > 150 ? '...' : ''}
                   </div>
                 )}

                 <div className="inspector-actions">
                   <button className="action-btn feynman" onClick={() => navigate(`/feynman/${selectedNode.id}`)}>
                     🎤 开始费曼练习
                   </button>
                   <button className="action-btn edit" onClick={() => navigate(`/kp/edit/${selectedNode.id}`)}>
                     ✏️ 编辑知识点
                   </button>
                 </div>
               </>
             ) : (
               <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '40px' }}>
                 请选择一个节点查看详情
               </div>
             )}
          </aside>
        </div>
      )}
    </div>
  );
}

export default GraphPage;