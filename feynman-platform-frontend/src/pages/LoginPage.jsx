// src/pages/LoginPage.jsx
import { useState } from 'react';
import apiClient from '../api/axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AppIcon from '../components/ui/AppIconFixed.jsx';
import './AuthPage.css';
import '../components/GuestBanner.css';

function LoginPage() {
  const [formData, setFormData] = useState({
    email: '', 
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleGuest = async () => {
    if (loading || guestLoading) return;
    setGuestLoading(true); setError('');
    try {
      const { data } = await apiClient.post('/users/guest');
      if (!data?.token) throw new Error('体验服务响应异常，请稍后重试');
      localStorage.removeItem('refreshToken');
      login(data.token, { username: '体验访客', guest: true });
      navigate('/', { replace: true });
    } catch (err) { setError(err.response?.data?.msg || err.message || '暂时无法进入体验，请稍后重试'); }
    finally { setGuestLoading(false); }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await apiClient.post('/users/login', formData);
      const { token } = response.data || {};
      const derivedUser = response.data?.user
        || (response.data?.email || response.data?.username
            ? { email: response.data.email, username: response.data.username }
            : null);
      if (token) {
        login(token, derivedUser);
        navigate('/');
      } else {
        setError('登录响应格式错误');
      }
    } catch (err) {
      setError(err.response?.data?.msg || '登录失败，请检查邮箱和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon" aria-hidden="true"><AppIcon name="assistant" size={58} accent="#A9BED3" /></div>
          <h1>欢迎回来</h1>
          <p>登录你的账户继续学习</p>
        </div>
        
        <div className="auth-body guest-login-body">
          <form className="auth-form" onSubmit={handleSubmit}>
            {error && (
              <div className="auth-error">
                <span></span> {error}
              </div>
            )}
            
            <div className="form-group">
              <label> 邮箱地址</label>
              <input 
                name="email"
                type="email" 
                value={formData.email} 
                onChange={handleChange}
                placeholder="请输入邮箱"
                required
              />
            </div>
            
            <div className="form-group">
              <label> 密码</label>
              <input 
                name="password"
                type="password" 
                value={formData.password}
                onChange={handleChange}
                placeholder="请输入密码"
                required
              />
            </div>
            
            <button type="submit" className="auth-submit" disabled={loading || guestLoading}>
              {loading ? (
                <span className="auth-loading">登录中</span>
              ) : (
                ' 登录'
              )}
            </button>
          </form>
          <section className="guest-entry" aria-label="免注册体验">
            <span>先了解一下？无需填写邮箱和密码</span>
            <button type="button" className="guest-entry-button" disabled={loading || guestLoading} onClick={handleGuest}>
              <AppIcon name="book" size={21} accent="#A8D1D3" />{guestLoading ? '正在准备独立体验空间…' : '免注册，立即体验'}
            </button>
            <small>含示例知识点 · 临时数据保留24小时 · AI请求次数有限<br />请勿录入敏感资料；注册后可保留当前体验数据。</small>
          </section>
        </div>
        
        <div className="auth-footer">
          <p>还没有账户？ <Link to="/register">立即注册</Link></p>
        </div>
      </div>
    </div>
  );
}
export default LoginPage;
