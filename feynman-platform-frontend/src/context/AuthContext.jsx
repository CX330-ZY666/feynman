// src/context/AuthContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';
import apiClient from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(localStorage.getItem('token')); // 当前访问令牌
    const [user, setUser] = useState(() => {
        return null;
    }); // 当前登录用户信息

    // 简单的JWT解码工具（不校验签名，仅提取payload）
    const decodeJwtPayload = (jwtToken) => {
        try {
            const [, payloadBase64] = jwtToken.split('.');
            if (!payloadBase64) return null;
            const json = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
            return JSON.parse(decodeURIComponent(escape(json)));
        } catch (e) {
            console.warn('decodeJwtPayload failed:', e);
            return null;
        }
    };

    useEffect(() => {
        let cancelled = false;
        if (token) {
            localStorage.setItem('token', token);
            // 若没有user，尝试从token中解析
            if (!user) {
                const payload = decodeJwtPayload(token);
                if (payload) {
                    const derived = {
                        username: payload.username || payload.name || null,
                        email: payload.email || null,
                        userId: payload.userId || payload.uid || (payload.user && payload.user.id) || null,
                    };
                    if (derived.username || derived.email || derived.userId) {
                        setUser(derived);
                    }
                }
            }
            // 若仍没有email/username，尝试请求后端获取当前用户资料
            {
                (async () => {
                    try {
                        const res = await apiClient.get('/users/me', {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        const u = res.data?.user || res.data || null;
                        if (u && !cancelled) {
                            setUser({
                                username: u.username || u.name || null,
                                email: u.email || null,
                                userId: u.id || u._id || user?.userId || null,
                                guest: !!u.guest,
                                guestExpiresAt: u.guestExpiresAt || null,
                            });
                        }
                    } catch (e) {
                        console.warn('获取当前用户资料失败:', e?.response?.data || e?.message);
                    }
                })();
            }
        } else {
            localStorage.removeItem('token');
        }
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    useEffect(() => {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
    }, [user]);

    const login = (newToken, newUser) => {
        localStorage.setItem('token', newToken);
        setUser(null);
        setToken(newToken);
        if (newUser) {
            setUser(newUser);
        } else if (newToken) {
            const payload = decodeJwtPayload(newToken);
            if (payload) {
                const derived = {
                    username: payload.username || payload.name || null,
                    email: payload.email || null,
                    userId: payload.userId || payload.uid || (payload.user && payload.user.id) || null,
                };
                if (derived.username || derived.email || derived.userId) {
                    setUser(derived);
                }
            }
        }
    };

    const logout = () => {
        ['token', 'refreshToken', 'user'].forEach((key) => localStorage.removeItem(key));
        setToken(null);
        setUser(null);
    };

    // 2. 将 state 和函数通过 value prop 提供出去
    const value = { token, user, login, logout, updateUser: setUser };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 3. 创建一个自定义Hook，方便其他组件使用
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

