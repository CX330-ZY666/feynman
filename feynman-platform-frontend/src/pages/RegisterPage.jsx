// src/pages/RegisterPage.jsx
import { useState } from 'react';
import apiClient from '../api/axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AppIcon from '../components/ui/AppIconFixed.jsx';
import './AuthPage.css';

function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, user } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 密码强度检测
  const getPasswordStrength = (password) => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return Math.min(strength, 4);
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (formData.password.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.post('/users/register', {
        username: formData.username,
        email: formData.email,
        password: formData.password
      });
      const { token } = response.data || {};
      if (!token) {
        setError('账号已创建，但未收到登录凭证，请点击下方“返回登录”继续。');
        return;
      }
      login(token, response.data?.user || {
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.msg || '注册失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon" aria-hidden="true"><AppIcon name="assistant" size={58} accent="#E99AA8" /></div>
          <h1>创建账户</h1>
          <p>加入我们，开始你的学习之旅</p>
        </div>
        
        <div className="auth-body">
          <form className="auth-form" onSubmit={handleSubmit}>
            {user?.guest && <p className="guest-upgrade-note">注册成功后，将保留当前体验空间的知识点和学习记录。</p>}
            {error && (
              <div className="auth-error">
                <span></span> {error}
              </div>
            )}
            
            <div className="form-group">
              <label> 用户名</label>
              <input 
                name="username"
                type="text" 
                value={formData.username} 
                onChange={handleChange}
                placeholder="请输入用户名"
                required
              />
            </div>
            
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
              <label> 设置密码</label>
              <input 
                name="password"
                type="password" 
                value={formData.password}
                onChange={handleChange}
                placeholder="至少6位字符"
                required
              />
              {formData.password && (
                <div className="password-strength">
                  {[1, 2, 3, 4].map(level => (
                    <div 
                      key={level} 
                      className={`strength-bar ${
                        passwordStrength >= level 
                          ? (passwordStrength <= 1 ? 'weak' : passwordStrength <= 2 ? 'medium' : 'strong')
                          : ''
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
            
            <div className="form-group">
              <label> 确认密码</label>
              <input 
                name="confirmPassword"
                type="password" 
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="再次输入密码"
                required
              />
            </div>
            
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <span className="auth-loading">注册中</span>
              ) : (
                ' 立即注册'
              )}
            </button>
          </form>
        </div>
        
        <div className="auth-footer">
          <p>已有账户？ <Link to="/login">返回登录</Link></p>
        </div>
      </div>
    </div>
  );
}
export default RegisterPage;
