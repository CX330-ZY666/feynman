// src/pages/FeynmanPracticeSelectPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/axios';
import './FeynmanPracticeSelectPage.css';

function FeynmanPracticeSelectPage() {
  const navigate = useNavigate();
  const [knowledgePoints, setKnowledgePoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    const fetchKnowledgePoints = async () => {
      try {
        const response = await apiClient.get('/knowledge-points');
        // 处理不同的API返回格式
        const data = response.data;
        if (Array.isArray(data)) {
          setKnowledgePoints(data);
        } else if (data && Array.isArray(data.knowledgePoints)) {
          setKnowledgePoints(data.knowledgePoints);
        } else if (data && Array.isArray(data.data)) {
          setKnowledgePoints(data.data);
        } else {
          setKnowledgePoints([]);
        }
      } catch (err) {
        console.error('获取知识点失败:', err);
        setError('加载知识点失败');
      } finally {
        setLoading(false);
      }
    };
    fetchKnowledgePoints();
  }, []);

  // 获取所有分类
  const categories = Array.isArray(knowledgePoints) 
    ? [...new Set(knowledgePoints.map(kp => kp.category).filter(Boolean))]
    : [];

  // 分类名称映射
  const categoryDisplayName = (cat) => {
    if (cat === 'general') return '通用';
    return cat;
  };

  // 去除HTML标签
  const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  };

  // 过滤知识点
  const filteredKPs = knowledgePoints.filter(kp => {
    const matchesSearch = !searchQuery || 
      kp.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kp.content?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || kp.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSelectKP = (kpId) => {
    navigate(`/feynman-practice/${kpId}`);
  };

  if (loading) {
    return (
      <div className="feynman-select-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="feynman-select-container">
      {/* 页面头部 */}
      <div className="select-header">
        <div className="header-content">
          <h1> 费曼练习</h1>
          <p className="header-desc">
            选择一个知识点，通过"教"的方式检验你的理解程度。AI学生「小问」会认真听你讲解并提出问题。
          </p>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="filter-bar">
        <div className="search-box">
          <span className="search-icon"></span>
          <input
            type="text"
            placeholder="搜索知识点..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-btn" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>

        {/* 只有多个分类时才显示筛选 */}
        {categories.length > 1 && (
          <div className="category-filter">
            <button
              className={`category-btn ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              全部
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {categoryDisplayName(cat)}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* 知识点列表 */}
      {filteredKPs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"></div>
          <h3>没有找到知识点</h3>
          <p>
            {knowledgePoints.length === 0 
              ? '还没有创建任何知识点，先去创建一些吧！' 
              : '没有匹配的知识点，试试其他搜索条件？'}
          </p>
          {knowledgePoints.length === 0 && (
            <button className="create-btn" onClick={() => navigate('/kp/new')}>
               创建知识点
            </button>
          )}
        </div>
      ) : (
        <div className="kp-grid">
          {filteredKPs.map(kp => (
            <div 
              key={kp._id} 
              className="kp-card"
              onClick={() => handleSelectKP(kp._id)}
            >
              <div className="kp-card-header">
                <h3>{kp.title}</h3>
                {kp.category && categories.length > 1 && (
                  <span className="kp-category">{categoryDisplayName(kp.category)}</span>
                )}
              </div>
              <p className="kp-content">
                {kp.content ? (() => {
                  const text = stripHtml(kp.content);
                  return text.substring(0, 100) + (text.length > 100 ? '...' : '');
                })() : '暂无内容'}
              </p>
              <div className="kp-card-footer">
                <span className={`kp-status ${kp.status === 'mastered' ? 'status-mastered' : kp.reviewList ? 'status-reviewing' : 'status-learning'}`}>
                  {kp.status === 'mastered' ? ' 已掌握' : kp.reviewList ? ' 需复习' : ' 学习中'}
                </span>
                <button className="start-practice-btn">
                  开始练习 →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 使用说明 */}
      <div className="tips-section">
        <h3> 什么是费曼学习法？</h3>
        <div className="tips-content">
          <div className="tip-item">
            <span className="tip-number">1</span>
            <div>
              <strong>选择概念</strong>
              <p>选择你想要学习或复习的知识点</p>
            </div>
          </div>
          <div className="tip-item">
            <span className="tip-number">2</span>
            <div>
              <strong>假装教别人</strong>
              <p>用最简单的语言向AI学生解释这个概念</p>
            </div>
          </div>
          <div className="tip-item">
            <span className="tip-number">3</span>
            <div>
              <strong>发现盲点</strong>
              <p>AI会追问你不清楚的地方，帮你发现理解漏洞</p>
            </div>
          </div>
          <div className="tip-item">
            <span className="tip-number">4</span>
            <div>
              <strong>回顾补强</strong>
              <p>针对薄弱点重新学习，直到能清晰解释</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FeynmanPracticeSelectPage;
