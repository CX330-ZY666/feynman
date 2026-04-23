// src/api/axios.js
import axios from 'axios';

const apiBaseURL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');

const apiClient = axios.create({
    baseURL: apiBaseURL,
    timeout: 25000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// 添加一个请求拦截器：仅附带 Authorization: Bearer <token>
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token'); // 从localStorage获取token
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

let isRefreshing = false;
let refreshPromise = null;

// 统一处理 401：支持 TOKEN_EXPIRED 自动刷新并重试一次
apiClient.interceptors.response.use(
    (res) => res,
    (error) => {
        // Render 免费实例或边缘网络偶发断连时，GET 请求自动重试一次
        const isNetworkError = !error.response;
        const method = error?.config?.method?.toLowerCase();
        const originalRequest = error.config || {};
        if (isNetworkError && method === 'get' && !originalRequest._networkRetried) {
            originalRequest._networkRetried = true;
            return new Promise((resolve) => {
                setTimeout(() => resolve(apiClient(originalRequest)), 800);
            });
        }

        const status = error?.response?.status;
        const errCode = error?.response?.data?.error || error?.response?.data?.code;
        

        if (status === 401 && errCode === 'TOKEN_EXPIRED' && !originalRequest._retry) {
            originalRequest._retry = true;
            if (!isRefreshing) {
                isRefreshing = true;
                refreshPromise = apiClient.post('/users/refresh')
                    .then((resp) => {
                        const newToken = resp?.data?.token;
                        if (newToken) {
                            localStorage.setItem('token', newToken);
                            return newToken;
                        }
                        throw new Error('No token in refresh response');
                    })
                    .finally(() => {
                        isRefreshing = false;
                    });
            }
            return refreshPromise.then((newToken) => {
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                return apiClient(originalRequest);
            }).catch(() => {
                // 刷新失败则清理并跳登录
                try {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                } catch (err) {
                    console.warn('清理localStorage失败:', err);
                }
                if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                    window.location.href = '/login';
                }
                return Promise.reject(error);
            });
        }

        if (status === 401) {
            try {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            } catch (err) {
                console.warn('清理localStorage失败:', err);
            }
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;

