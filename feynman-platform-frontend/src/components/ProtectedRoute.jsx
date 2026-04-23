// src/components/ProtectedRoute.jsx
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate, Outlet } from 'react-router-dom';

function ProtectedRoute() {
    const { token } = useAuth(); // 从全局状态获取token

    // 如果没有token，重定向到登录页
    if (!token) {
        return <Navigate to="/login" replace />; 
        // replace: 替换当前历史记录，用户点后退不会回到受保护的页面
    }

    // 如果有token，正常渲染子路由（通过Outlet）
    return <Outlet />;
}

export default ProtectedRoute;

