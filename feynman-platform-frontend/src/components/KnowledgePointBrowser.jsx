import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/axios';
import AppIcon from './ui/AppIconFixed';
import './KnowledgePointBrowser.css';

function KnowledgePointBrowser() {
  const [knowledgePoints, setKnowledgePoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterReview, setFilterReview] = useState(false);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    const fetchKnowledgePoints = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/knowledge-points');
        const data = response.data;
        setKnowledgePoints(Array.isArray(data) ? data : (data?.knowledgePoints || []));
      } catch (err) {
        setError(err?.response?.data?.msg || '获取知识点失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };
    fetchKnowledgePoints();
  }, []);

  const filteredList = useMemo(() => {
    const source = filterReview ? knowledgePoints.filter((kp) => kp.reviewList) : knowledgePoints;
    return [...source].sort((a, b) => {
      if (sortBy === 'title') {
        const result = (a.title || '').localeCompare(b.title || '', 'zh-CN');
        return sortOrder === 'asc' ? result : -result;
      }
      const result = new Date(a[sortBy] || 0) - new Date(b[sortBy] || 0);
      return sortOrder === 'asc' ? result : -result;
    });
  }, [filterReview, knowledgePoints, sortBy, sortOrder]);

  const reviewCount = knowledgePoints.filter((kp) => kp.reviewList).length;

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除这个知识点吗？删除后无法恢复。')) return;
    try {
      setUpdatingId(id);
      await apiClient.delete(`/knowledge-points/${id}`);
      setKnowledgePoints((prev) => prev.filter((kp) => kp._id !== id));
    } catch (err) {
      window.alert(`删除失败：${err?.response?.data?.msg || err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSetMastered = async (id) => {
    try {
      setUpdatingId(id);
      await apiClient.put(`/knowledge-points/${id}/status`, { status: 'mastered' });
      setKnowledgePoints((prev) => prev.map((kp) => kp._id === id ? { ...kp, status: 'mastered' } : kp));
    } catch (err) {
      window.alert(`设置已掌握失败：${err?.response?.data?.msg || err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleReview = async (id, current) => {
    try {
      setUpdatingId(id);
      await apiClient.put(`/knowledge-points/${id}/review`, { reviewList: !current });
      setKnowledgePoints((prev) => prev.map((kp) => kp._id === id ? { ...kp, reviewList: !current } : kp));
    } catch (err) {
      window.alert(`更新复习标记失败：${err?.response?.data?.msg || err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (value) => value
    ? new Date(value).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

  if (loading) return <div className="browser-state"><AppIcon name="loading" size={30} accent="#A9BED3" /><strong>正在整理知识目录…</strong></div>;
  if (error) return <div className="browser-state browser-state-error"><AppIcon name="error" size={30} accent="#E99AA8" /><div><strong>标题浏览加载失败</strong><p>{error}</p></div></div>;

  return (
    <main className="knowledge-browser-container">
      <header className="browser-hero">
        <div className="browser-heading">
          <span className="browser-heading-icon"><AppIcon name="list" size={30} accent="#A9BED3" /></span>
          <div>
            <small>KNOWLEDGE INDEX</small>
            <h1>标题浏览</h1>
            <p>按标题和时间快速管理你的全部知识点</p>
          </div>
        </div>
        <div className="browser-summary" aria-label="知识点统计">
          <span><b>{knowledgePoints.length}</b>全部知识点</span>
          <span><b>{reviewCount}</b>待复习</span>
        </div>
      </header>

      <section className="browser-toolbar" aria-label="标题浏览工具栏">
        <div className="browser-filter-group">
          <button className={`browser-button ${filterReview ? 'is-active' : ''}`} onClick={() => setFilterReview((value) => !value)}>
            <AppIcon name="filter" size={18} accent="#E99AA8" />
            {filterReview ? '显示全部' : `只看待复习（${reviewCount}）`}
          </button>
          <label className="browser-select-wrap">
            <AppIcon name="settings" size={18} accent="#C9C3DF" />
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="排序字段">
              <option value="updatedAt">最近更新</option>
              <option value="createdAt">创建时间</option>
              <option value="title">标题名称</option>
            </select>
          </label>
          <button className="browser-button browser-sort" onClick={() => setSortOrder((value) => value === 'asc' ? 'desc' : 'asc')}>
            <AppIcon name={sortOrder === 'asc' ? 'next' : 'back'} size={18} accent="#A9BED3" />
            {sortOrder === 'asc' ? '升序' : '降序'}
          </button>
        </div>
        <div className="browser-primary-actions">
          <Link className="browser-button" to="/"><AppIcon name="home" size={18} accent="#A9BED3" />详情视图</Link>
          <Link className="browser-button browser-create" to="/kp/new"><AppIcon name="add" size={18} accent="#EFD46D" />新建知识点</Link>
        </div>
      </section>

      {filteredList.length === 0 ? (
        <section className="browser-empty">
          <span><AppIcon name={filterReview ? 'success' : 'book'} size={42} accent={filterReview ? '#BCD4BF' : '#EFD46D'} /></span>
          <h2>{filterReview ? '目前没有待复习内容' : '还没有知识点'}</h2>
          <p>{filterReview ? '状态很好，继续保持当前学习节奏。' : '创建第一个知识点，开始费曼学习。'}</p>
          {!filterReview && <Link className="browser-button browser-create" to="/kp/new"><AppIcon name="add" size={18} accent="#EFD46D" />新建知识点</Link>}
        </section>
      ) : (
        <section className="browser-list-panel">
          <div className="browser-list-head">
            <span>知识点标题</span><span>创建时间</span><span>更新时间</span><span>操作</span>
          </div>
          <div className="browser-list">
            {filteredList.map((kp, index) => {
              const busy = updatingId === kp._id;
              return (
                <article className={`browser-row ${kp.reviewList ? 'needs-review' : ''}`} key={kp._id}>
                  <div className="browser-title-cell">
                    <span className="browser-index">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <Link to={`/kp/edit/${kp._id}`}>{kp.title || '未命名知识点'}</Link>
                      <div className="browser-badges">
                        {kp.reviewList && <span className="browser-badge review">待复习</span>}
                        {kp.status === 'mastered' && <span className="browser-badge mastered">已掌握</span>}
                      </div>
                    </div>
                  </div>
                  <time data-label="创建时间">{formatDate(kp.createdAt)}</time>
                  <time data-label="更新时间">{formatDate(kp.updatedAt)}</time>
                  <div className="browser-row-actions">
                    <Link title="编辑" to={`/kp/edit/${kp._id}`}><AppIcon name="edit" size={18} accent="#A9BED3" /><span>编辑</span></Link>
                    <Link title="复述" to={`/feynman/${kp._id}`}><AppIcon name="microphone" size={18} accent="#E99AA8" /><span>复述</span></Link>
                    <button title="设为已掌握" onClick={() => handleSetMastered(kp._id)} disabled={busy}><AppIcon name="success" size={18} accent="#BCD4BF" /><span>掌握</span></button>
                    <button title="切换复习标记" onClick={() => handleToggleReview(kp._id, kp.reviewList)} disabled={busy}><AppIcon name="timer" size={18} accent="#EFD46D" /><span>{kp.reviewList ? '取消复习' : '待复习'}</span></button>
                    <button className="danger" title="删除" onClick={() => handleDelete(kp._id)} disabled={busy}><AppIcon name="delete" size={18} accent="#E99AA8" /><span>删除</span></button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <footer className="browser-footer">当前显示 {filteredList.length} 个知识点，共 {knowledgePoints.length} 个</footer>
    </main>
  );
}

export default KnowledgePointBrowser;