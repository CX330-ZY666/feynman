import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/axios';
import AppIcon from './ui/AppIconFixed';
import './GuestBanner.css';

export default function GuestBanner() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!user?.guest) return;
    let active = true;
    const refresh = () => apiClient.get('/users/guest/usage').then(({ data }) => { if (active) setRemaining(data.remaining); }).catch(() => {});
    refresh();
    window.addEventListener('guest-usage-updated', refresh);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('guest-usage-updated', refresh); window.removeEventListener('focus', refresh); };
  }, [user?.guest, pathname]);
  if (!user?.guest) return null;
  return <section className="guest-banner" aria-label="体验模式说明">
    <span className="guest-banner-icon"><AppIcon name="book" size={24} accent="#A8D1D3" /></span>
    <div><strong>你正在使用独立体验空间</strong><p>临时数据保留24小时，AI请求{remaining == null ? '次数有限' : `剩余 ${remaining} 次`}（含失败请求）。在线转写、文件导入需正式账号。</p></div>
    <div className="guest-banner-actions"><Link to="/register">注册并保留数据</Link><button type="button" onClick={logout}>退出体验</button></div>
  </section>;
}
