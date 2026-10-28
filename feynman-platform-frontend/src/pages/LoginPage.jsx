// src/pages/LoginPage.jsx
import { useState } from 'react';
import apiClient from '../api/axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AppIcon from '../components/ui/AppIconFixed.jsx';
import './AuthPage.css';

function LoginPage() {
  const [formData, setFormData] = useState({
    email: '', 
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

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
        
        <div className="auth-body">
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
            
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <span className="auth-loading">登录中</span>
              ) : (
                ' 登录'
              )}
            </button>
          </form>
        </div>
        
        <div className="auth-footer">
          <p>还没有账户？ <Link to="/register">立即注册</Link></p>
        </div>
      </div>
    </div>
  );
}
export default LoginPage;
