// src/components/KnowledgePointBrowser.jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axios';

/**
 * 知识点标题浏览列表组件
 * 功能：
 * - 展示所有知识点标题（不展开内容）
 * - 支持筛选需复习的知识点
 * - 支持按创建时间/更新时间排序
 * - 支持快速导航到编辑/复述页面
 */
function KnowledgePointBrowser() {
  const [knowledgePoints, setKnowledgePoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterReview, setFilterReview] = useState(false);
  const [sortBy, setSortBy] = useState('updatedAt'); // 'createdAt' | 'updatedAt' | 'title'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [updatingId, setUpdatingId] = useState(null); // 当前正在更新状态的知识点

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

  // 筛选 + 排序逻辑
  const processedKnowledgePoints = () => {
    let result = filterReview 
      ? knowledgePoints.filter(kp => kp.reviewList) 
      : knowledgePoints;

    // 排序
    result = [...result].sort((a, b) => {
      let valueA, valueB;
      
      if (sortBy === 'title') {
        valueA = (a.title || '').toLowerCase();
        valueB = (b.title || '').toLowerCase();
        return sortOrder === 'asc' 
          ? valueA.localeCompare(valueB) 
          : valueB.localeCompare(valueA);
      }
      
      // 按时间排序
      valueA = new Date(a[sortBy] || 0);
      valueB = new Date(b[sortBy] || 0);
      return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
    });

    return result;
  };

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除这个知识点？')) return;
    try {
      await apiClient.delete(`/knowledge-points/${id}`);
      setKnowledgePoints(prev => prev.filter(kp => kp._id !== id));
    } catch (err) {
      alert(`删除失败：${err?.response?.data?.msg || err.message}`);
    }
  };

  // 快速将知识点状态设为 mastered
  const handleSetMastered = async (id) => {
    try {
      setUpdatingId(id);
      await apiClient.put(`/knowledge-points/${id}/status`, { status: 'mastered' });
      setKnowledgePoints(prev => prev.map(kp => kp._id === id ? { ...kp, status: 'mastered' } : kp));
    } catch (err) {
      alert(`设置为已掌握失败：${err?.response?.data?.msg || err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  // 切换 reviewList（需要复习标记）
  const handleToggleReview = async (id, current) => {
    const next = !current;
    try {
      setUpdatingId(id);
      await apiClient.put(`/knowledge-points/${id}/review`, { reviewList: next });
      setKnowledgePoints(prev => prev.map(kp => kp._id === id ? { ...kp, reviewList: next } : kp));
    } catch (err) {
      alert(`更新复习标记失败：${err?.response?.data?.msg || err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return <p>⏳ 加载中...</p>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;

  const filteredList = processedKnowledgePoints();
  const reviewCount = knowledgePoints.filter(kp => kp.reviewList).length;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {/* 头部控制栏 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>
          📚 知识点浏览
        </h1>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 返回详情视图 */}
          <Link to="/">
            <button style={{
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}>
              📝 详情视图
            </button>
          </Link>
          
          {/* 筛选按钮 */}
          <button
            onClick={() => setFilterReview(!filterReview)}
            style={{
              background: filterReview ? '#ef4444' : '#e5e7eb',
              color: filterReview ? 'white' : '#374151',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            {filterReview ? '🔍 全部' : `⚠️ 需复习 (${reviewCount})`}
          </button>

          {/* 排序控制 */}
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              borderRadius: '8px', 
              border: '1px solid #d1d5db',
              cursor: 'pointer'
            }}
          >
            <option value="updatedAt">最近更新</option>
            <option value="createdAt">创建时间</option>
            <option value="title">标题排序</option>
          </select>

          <button 
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              background: 'white',
              cursor: 'pointer'
            }}
          >
            {sortOrder === 'asc' ? '↑ 升序' : '↓ 降序'}
          </button>

          <Link to="/kp/new">
            <button style={{ 
              background: '#3b82f6', 
              color: 'white',
              padding: '8px 16px', 
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer'
            }}>
              ➕ 新建知识点
            </button>
          </Link>
        </div>
      </div>

      {/* 列表表头 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 180px 180px 200px',
        gap: '16px',
        padding: '12px 16px',
        background: '#f3f4f6',
        borderRadius: '8px',
        fontWeight: '600',
        fontSize: '0.9rem',
        color: '#374151',
        marginBottom: '10px'
      }}>
        <div>📝 标题</div>
        <div>📅 创建时间</div>
        <div>🔄 更新时间</div>
        <div style={{ textAlign: 'center' }}>⚡ 操作</div>
      </div>

      {/* 知识点列表 */}
      {filteredList.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#6b7280',
          background: '#f9fafb',
          borderRadius: '8px'
        }}>
          {filterReview 
            ? '🎉 没有需要复习的知识点，继续加油！' 
            : '还没有任何知识点，快去创建一个吧！'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredList.map((kp) => (
            <div
              key={kp._id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 180px 180px 200px',
                gap: '16px',
                padding: '16px',
                background: kp.reviewList ? '#fef2f2' : 'white',
                border: kp.reviewList ? '2px solid #ef4444' : '1px solid #e5e7eb',
                borderRadius: '8px',
                alignItems: 'center',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* 标题列 */}
              <div style={{ 
                fontSize: '1rem', 
                fontWeight: '500',
                color: '#111827',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {kp.reviewList && (
                  <span style={{
                    background: '#ef4444',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600'
                  }}>
                    ⚠️
                  </span>
                )}
                <Link 
                  to={`/kp/edit/${kp._id}`}
                  style={{ 
                    textDecoration: 'none', 
                    color: '#111827',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {kp.title || '(无标题)'}
                </Link>
              </div>

              {/* 创建时间 */}
              <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                {formatDate(kp.createdAt)}
              </div>

              {/* 更新时间 */}
              <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                {formatDate(kp.updatedAt)}
              </div>

              {/* 操作按钮 */}
              <div style={{ 
                display: 'flex', 
                gap: '6px', 
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
                <Link to={`/kp/edit/${kp._id}`}>
                  <button style={{
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    background: 'white',
                    cursor: 'pointer'
                  }}>
                    ✏️ 编辑
                  </button>
                </Link>
                
                <Link to={`/feynman/${kp._id}`}>
                  <button style={{
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#10b981',
                    color: 'white',
                    cursor: 'pointer'
                  }}>
                    🎤 复述
                  </button>
                </Link>

                <button 
                  onClick={() => handleSetMastered(kp._id)}
                  disabled={updatingId === kp._id}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#22c55e',
                    color: 'white',
                    cursor: updatingId === kp._id ? 'wait' : 'pointer'
                  }}
                >
                  ✅ 已掌握
                </button>

                <button 
                  onClick={() => handleToggleReview(kp._id, kp.reviewList)}
                  disabled={updatingId === kp._id}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: kp.reviewList ? '#f97316' : '#e5e7eb',
                    color: kp.reviewList ? 'white' : '#374151',
                    cursor: updatingId === kp._id ? 'wait' : 'pointer'
                  }}
                >
                  {kp.reviewList ? '✅ 已标记复习' : '⚠️ 标记复习'}
                </button>

                <button 
                  onClick={() => handleDelete(kp._id)}
                  disabled={updatingId === kp._id}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#ef4444',
                    color: 'white',
                    cursor: updatingId === kp._id ? 'wait' : 'pointer'
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 统计信息 */}
      <div style={{ 
        marginTop: '20px', 
        padding: '12px',
        background: '#f9fafb',
        borderRadius: '8px',
        fontSize: '0.9rem',
        color: '#6b7280',
        textAlign: 'center'
      }}>
        共 {knowledgePoints.length} 个知识点 
        {reviewCount > 0 && ` | 需复习 ${reviewCount} 个`}
        {filterReview && ` | 当前显示 ${filteredList.length} 个`}
      </div>
    </div>
  );
}

export default KnowledgePointBrowser;
