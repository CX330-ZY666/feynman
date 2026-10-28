// src/components/Layout.jsx
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useState, useEffect } from 'react';
import './Layout.css';

function Layout() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 路由变化时触发动画
  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 50);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <nav className="nav-bar">
        <div className="nav-links">
          {token ? (
            <>
              <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}> 主页</Link>
              <Link to="/agent" className={`nav-link nav-link-ai ${location.pathname === '/agent' ? 'active' : ''}`}> AI助手</Link>
              <Link to="/feynman-practice" className={`nav-link nav-link-feynman ${location.pathname.startsWith('/feynman-practice') ? 'active' : ''}`}> 费曼问答</Link>
              <Link to="/graph" className={`nav-link nav-link-graph ${location.pathname === '/graph' ? 'active' : ''}`}> 知识图谱</Link>
              <Link to="/3d-world" className={`nav-link nav-link-3d ${location.pathname === '/3d-world' ? 'active' : ''}`}> 3D 视界</Link>
              <Link to="/knowledge-universe" className={`nav-link nav-link-universe ${location.pathname === '/knowledge-universe' ? 'active' : ''}`}> 知识宇宙</Link>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">登录</Link>
              <Link to="/register" className="nav-link">注册</Link>
            </>
          )}
        </div>
        <div className="nav-user">
          {token && (
            <span className="user-welcome">
              {user?.email || user?.username || user?.userId
                ? `欢迎，${user?.email || user?.username || `用户#${user?.userId}`}`
                : '欢迎，正在加载用户信息'}
            </span>
          )}
          <span className={`status-badge ${token ? 'status-online' : 'status-offline'}`}>
            <span className="status-dot"></span>
            {token ? '已登录' : '未登录'}
          </span>
          {token && (
            <button onClick={handleLogout} className="logout-btn">
              退出登录
            </button>
          )}
        </div>
      </nav>
      
      <main className={`main-area ${isTransitioning ? '' : 'fade-in'}`}>
        <Outlet /> 
      </main>
    </div>
  );
}
export default Layout;