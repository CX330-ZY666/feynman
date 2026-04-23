// src/pages/DashboardPage.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import { PRESET_TAGS, getTagConfig } from '../utils/tagConfig';
import './DashboardPage.css';

// 用于自动匹配的关键词配置（当没有存储标签时作为回退）
const TAG_KEYWORDS = {
  '前端': ['React', 'Vue', 'CSS', 'JavaScript', 'JS', 'HTML', 'Web'],
  '后端': ['Python', 'Java', 'Node', 'API', '服务', 'Express'],
  '数据库': ['SQL', 'MongoDB', 'MySQL', 'Redis'],
  'AI': ['人工智能', '机器学习', '深度学习', 'GPT'],
  '算法': ['数据结构', '排序', '动态规划'],
  '设计': ['UI', 'UX', '界面', 'Figma'],
  '项目': ['管理', '进度', 'Scrum'],
  '合同': ['协议', '法律', '条款'],
};

// 根据标题自动匹配标签（回退逻辑）
const autoMatchTag = (title) => {
  if (!title) return null;
  const lowerTitle = title.toLowerCase();
  for (const [tagName, keywords] of Object.entries(TAG_KEYWORDS)) {
    if (keywords.some(kw => lowerTitle.includes(kw.toLowerCase())) || 
        lowerTitle.includes(tagName.toLowerCase())) {
      return tagName;
    }
  }
  return null;
};

function DashboardPage() {
  const [knowledgePoints, setKnowledgePoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterReview, setFilterReview] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeKpId, setActiveKpId] = useState(null);
  const [searchQuery, setSearchQuery] = useState(''); // 搜索关键词
  const [tagFilter, setTagFilter] = useState(''); // 标签筛选

  useEffect(() => {
    const fetchKnowledgePoints = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/knowledge-points');
        // 兼容新格式：{ knowledgePoints, relations } 和旧格式：[...]
        const data = response.data;
        const kps = Array.isArray(data) ? data : (Array.isArray(data?.knowledgePoints) ? data.knowledgePoints : []);
        setKnowledgePoints(kps);
      } catch (err) {
        setError('获取知识点失败');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledgePoints();
  }, []);

  // 当列表变化时初始化并触发 Mermaid 渲染（渲染在自定义代码块里）
  useEffect(() => {
    try {
      mermaid.initialize({ startOnLoad: true, theme: 'default' });
      mermaid.contentLoaded();
    } catch (e) {
      // 不中断页面
      console.warn('Mermaid 初始化失败: ', e?.message);
    }
  }, [knowledgePoints]);

  const handleDelete = async (id) => {
    if (!window.confirm('你确定要删除这个知识点吗？')) return;
    try {
      console.log('发起删除请求:', `/knowledge-points/${id}`);
      const res = await apiClient.delete(`/knowledge-points/${id}`);
      console.log('删除成功，响应:', res?.status, res?.data);
      setKnowledgePoints((prev) => prev.filter((kp) => kp._id !== id));
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      console.error('删除失败:', status, data || err?.message);
      if (status === 401 || status === 403) {
        alert('没有权限或未登录，请先登录再试');
      } else if (status === 404) {
        alert('该知识点不存在或已被删除');
      } else {
        alert(`删除失败：${data?.msg || data?.error || err?.message || '未知错误'}`);
      }
    }
  };

  if (loading) return (
    <div className="dashboard-container">
      <div className="loading-state">
        <div className="loading-spinner"></div>
        <p>加载中...</p>
      </div>
    </div>
  );
  if (error) return (
    <div className="dashboard-container">
      <div className="error-state">❌ {error}</div>
    </div>
  );

  // 获取知识点的标签（优先存储的，否则自动匹配）
  const getKpTags = (kp) => {
    if (kp.tags && kp.tags.length > 0) {
      return kp.tags;
    }
    // 回退：自动匹配
    const autoTag = autoMatchTag(kp.title);
    return autoTag ? [autoTag] : [];
  };

  // 筛选逻辑：结合搜索、标签和复习筛选
  // 确保 knowledgePoints 是数组
  const safeKnowledgePoints = Array.isArray(knowledgePoints) ? knowledgePoints : [];
  const filteredKnowledgePoints = safeKnowledgePoints.filter(kp => {
    const matchesSearch = !searchQuery || 
      kp.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kp.content?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesReview = !filterReview || kp.reviewList;
    const matchesTag = !tagFilter || getKpTags(kp).includes(tagFilter);
    return matchesSearch && matchesReview && matchesTag;
  });
  
  const reviewCount = safeKnowledgePoints.filter(kp => kp.reviewList).length;

  // 统计所有标签及其数量
  const allTags = safeKnowledgePoints.reduce((acc, kp) => {
    getKpTags(kp).forEach(tag => {
      acc[tag] = (acc[tag] || 0) + 1;
    });
    return acc;
  }, {});

  // 滚动到指定知识点
  const scrollToKp = (kpId) => {
    setActiveKpId(kpId);
    const element = document.getElementById(`kp-${kpId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 2秒后取消高亮
      setTimeout(() => setActiveKpId(null), 2000);
    }
  };

  return (
    <div className={`dashboard-container ${showSidebar ? 'with-sidebar' : ''}`}>
      {/* 左侧目录栏 */}
      {showSidebar && (
        <aside className="sidebar">
          <div className="sidebar-header">
            <h3>📚 知识点目录</h3>
            <button className="sidebar-close" onClick={() => setShowSidebar(false)}>×</button>
          </div>
          <ul className="sidebar-list">
            {filteredKnowledgePoints.map((kp, index) => (
              <li 
                key={kp._id} 
                className={`sidebar-item ${kp.reviewList ? 'needs-review' : ''} ${activeKpId === kp._id ? 'active' : ''}`}
                onClick={() => scrollToKp(kp._id)}
              >
                <span className="sidebar-index">{index + 1}</span>
                <span className="sidebar-title">{kp.title}</span>
                {kp.reviewList && <span className="sidebar-badge">⚠️</span>}
              </li>
            ))}
          </ul>
        </aside>
      )}

      {/* 主内容区 */}
      <div className="main-content">
        {/* 页面头部 */}
        <div className="dashboard-header">
          <div className="header-info">
            <h1>📚 我的知识点</h1>
            <div className="header-stats">
              <span className="stat-item">📖 总计 <span className="stat-value">{safeKnowledgePoints.length}</span> 个</span>
              <span className="stat-item">🔔 待复习 <span className="stat-value">{reviewCount}</span> 个</span>
            </div>
          </div>
          {/* 搜索框 */}
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="搜索知识点..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>
          {/* 标签筛选 */}
          <div className="tag-filter">
            <select 
              value={tagFilter} 
              onChange={(e) => setTagFilter(e.target.value)}
              className="tag-select"
            >
              <option value="">🏷️ 全部标签</option>
              {Object.entries(allTags).sort((a, b) => b[1] - a[1]).map(([tag, count]) => {
                const config = getTagConfig(tag);
                return (
                  <option key={tag} value={tag}>
                    {config.icon} {tag} ({count})
                  </option>
                );
              })}
            </select>
          </div>
          <div className="header-actions">
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className={`btn btn-browse ${showSidebar ? 'active' : ''}`}
            >
              📊 {showSidebar ? '隐藏目录' : '标题浏览'}
            </button>
            <button 
              onClick={() => setFilterReview(!filterReview)}
              className={`btn btn-review ${filterReview ? 'active' : ''}`}
            >
              {filterReview ? '🔍 查看所有' : `⚠️ 需复习 (${reviewCount})`}
            </button>
            <Link to="/kp/new" className="btn btn-create">✨ 新建知识点</Link>
          </div>
        </div>

        {/* 知识点列表 */}
        <div>
        {filteredKnowledgePoints.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">{filterReview ? '🎉' : '📝'}</div>
            <h3 className="empty-title">
              {filterReview ? '太棒了！没有需要复习的知识点' : '还没有知识点'}
            </h3>
            <p className="empty-desc">
              {filterReview ? '继续保持学习的好习惯！' : '点击「新建知识点」开始你的学习之旅吧！'}
            </p>
          </div>
        ) : (
          <ul className="kp-list">
            {filteredKnowledgePoints.map((kp, index) => (
              <li 
                key={kp._id} 
                id={`kp-${kp._id}`}
                className={`kp-card ${kp.reviewList ? 'needs-review' : ''} ${activeKpId === kp._id ? 'highlight' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* 复习标记 */}
                {kp.reviewList && (
                  <span className="review-badge">⚠️ 需复习</span>
                )}
                
                {/* 标题行：标签 + 标题 */}
                <div className="kp-header">
                  <div className="kp-tags">
                    {getKpTags(kp).map(tag => {
                      const config = getTagConfig(tag);
                      return (
                        <span 
                          key={tag}
                          className="kp-tag" 
                          style={{ backgroundColor: config.color }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setTagFilter(tag === tagFilter ? '' : tag);
                          }}
                        >
                          {config.icon} {tag}
                        </span>
                      );
                    })}
                  </div>
                  <h2 className="kp-title">{kp.title}</h2>
                </div>
                <div className="kp-content">
                  {/* 判断内容格式：如果是 HTML，使用 DOMPurify 清理后渲染 */}
                  {kp.content && kp.content.includes('<') ? (
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: DOMPurify.sanitize(kp.content, {
                          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'a', 'img'],
                          ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class']
                        }) 
                      }} 
                    />
                  ) : (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeSanitize, rehypeKatex]}
                      components={{
                        code({ inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          if (!inline && match && match[1] === 'mermaid') {
                            return (
                              <div className="mermaid" {...props}>
                                {String(children).replace(/\n$/, '')}
                              </div>
                            );
                          }
                          return <code className={className} {...props}>{children}</code>;
                        }
                      }}
                    >
                      {kp.content || ''}
                    </ReactMarkdown>
                  )}
                </div>
                <div className="kp-actions">
                  <Link to={`/kp/edit/${kp._id}`} className="kp-btn kp-btn-edit">✏️ 编辑</Link>
                  <button onClick={() => handleDelete(kp._id)} className="kp-btn kp-btn-delete">🗑️ 删除</button>
                  <Link to={`/feynman/${kp._id}`} className="kp-btn kp-btn-feynman">🎤 开始复述</Link>
                  <Link to={`/feynman-practice/${kp._id}`} className="kp-btn kp-btn-practice">🎓 费曼练习</Link>
                  <Link to={`/quiz/${kp._id}`} className="kp-btn kp-btn-quiz">📝 开始测评</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;