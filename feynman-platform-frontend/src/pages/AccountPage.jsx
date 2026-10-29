import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/axios';
import AppIcon from '../components/ui/AppIconFixed';
import './AccountPage.css';

export default function AccountPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  useEffect(() => { setUsername(user?.username || ''); }, [user?.username]);
  const run = async (name, action) => {
    setBusy(name); setNotice(null);
    try { await action(); }
    catch (error) { setNotice({ error: true, text: error.response?.data?.msg || error.response?.data?.message || error.message || '操作失败，请重试' }); }
    finally { setBusy(''); }
  };
  const signOut = () => { logout(); navigate('/login', { replace: true }); };
  if (user?.guest) return <div className="account-page"><section className="account-panel"><h1>体验账号</h1><p>当前空间独立保存，24小时后到期清理。注册可保留知识点和学习记录。</p><p>在线语音转写、文件导入和账号安全管理需要正式账号。</p><Link to="/register">注册并保留体验数据</Link><button type="button" onClick={signOut}>退出体验</button></section></div>;
  return <div className="account-page">
    <header className="account-heading"><span><AppIcon name="user" size={30} accent="#BCD4BF" /></span><div><h1>账号设置</h1><p>管理个人资料和账号安全</p></div><Link to="/">返回学习首页</Link></header>
    <div className="account-mobile-logout"><button onClick={signOut}>退出登录</button></div>
    {notice && <div className={`account-notice ${notice.error ? 'is-error' : ''}`} role={notice.error ? 'alert' : 'status'}><AppIcon name={notice.error ? 'error' : 'success'} size={20} />{notice.text}</div>}
    <section className="account-panel"><h2>个人资料</h2><p>学习页面将优先显示你的昵称。</p>
      <form onSubmit={(event) => { event.preventDefault(); run('profile', async () => { const { data } = await apiClient.put('/users/me', { username: username.trim() }); updateUser(data); setNotice({ text: '昵称已更新' }); }); }}>
        <label htmlFor="account-name">昵称</label><input id="account-name" value={username} onChange={(e) => setUsername(e.target.value)} minLength={2} maxLength={50} required autoComplete="nickname" />
        <label htmlFor="account-email">注册邮箱</label><input id="account-email" value={user?.email || ''} readOnly aria-describedby="email-note" /><small id="email-note">当前登录邮箱。邮箱验证与更换功能暂未开放。</small>
        <button disabled={!!busy || !user}>{busy === 'profile' ? '保存中…' : '保存昵称'}</button>
      </form>
    </section>
    <section className="account-panel"><h2>修改密码</h2><p>修改成功后，所有设备上的旧登录状态都会失效，需要重新登录。</p>
      <form onSubmit={(event) => { event.preventDefault(); if (newPassword !== repeatPassword) { setNotice({ error: true, text: '两次输入的新密码不一致' }); return; } run('password', async () => { await apiClient.put('/users/me/password', { currentPassword, newPassword }); signOut(); }); }}>
        <label htmlFor="current-password">当前密码</label><input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
        <label htmlFor="new-password">新密码（6～72字符）</label><input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} maxLength={72} required autoComplete="new-password" />
        <label htmlFor="repeat-password">再次输入新密码</label><input id="repeat-password" type="password" value={repeatPassword} onChange={(e) => setRepeatPassword(e.target.value)} minLength={6} maxLength={72} required autoComplete="new-password" />
        <button disabled={!!busy}>{busy === 'password' ? '修改中…' : '修改密码并重新登录'}</button>
      </form>
    </section>
    <section className="account-panel account-danger"><h2>注销账号</h2><p>永久删除账号，以及该账号的知识点、关系、复述记录和检索索引。此操作无法撤销。</p>
      {!deleting ? <button className="danger" onClick={() => setDeleting(true)}>申请注销账号</button> : <form onSubmit={(event) => { event.preventDefault(); run('delete', async () => { await apiClient.delete('/users/me', { data: { password: deletePassword, confirmation } }); signOut(); }); }}>
        <label htmlFor="delete-password">输入当前密码</label><input id="delete-password" type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} required autoComplete="current-password" />
        <label htmlFor="delete-confirm">输入“注销账号”确认删除</label><input id="delete-confirm" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
        <div className="account-actions"><button className="danger" disabled={!!busy || confirmation !== '注销账号'}>{busy === 'delete' ? '注销中…' : '永久注销账号'}</button><button type="button" disabled={!!busy} onClick={() => { setDeleting(false); setDeletePassword(''); setConfirmation(''); }}>取消</button></div>
      </form>}
    </section>
  </div>;
}
