// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx'; // 引入AuthProvider

// 使用 HashRouter 以支持 Electron 的 file:// 协议
ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </HashRouter>,
);
