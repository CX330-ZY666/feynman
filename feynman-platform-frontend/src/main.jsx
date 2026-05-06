// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx'; // 引入AuthProvider

// 开发环境或未启用 PWA 时，主动清理旧的 Service Worker 和缓存，
// 避免历史缓存损坏导致页面白屏。
if ('serviceWorker' in navigator && (import.meta.env.DEV || import.meta.env.VITE_ENABLE_PWA !== 'true')) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
    });
  });

  if ('caches' in window) {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((cacheName) => {
        caches.delete(cacheName);
      });
    });
  }
}

// 使用 HashRouter 以支持 Electron 的 file:// 协议
ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </HashRouter>,
);
