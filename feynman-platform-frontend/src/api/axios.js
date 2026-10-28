import axios from 'axios';

export const apiBaseURL = import.meta.env.VITE_API_URL
    || (import.meta.env.PROD ? '/api' : 'http://localhost:8080/api');

const apiClient = axios.create({
    baseURL: apiBaseURL,
    timeout: 65000,
    headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

let refreshPromise = null;

const clearSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
};

apiClient.interceptors.response.use(
    (response) => {
        const refreshToken = response?.data?.refreshToken;
        const path = response?.config?.url || '';
        if (refreshToken && (path.includes('/users/login') || path.includes('/users/register'))) {
            localStorage.setItem('refreshToken', refreshToken);
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config || {};
        const method = originalRequest.method?.toLowerCase();

        if (!error.response && method === 'get' && !originalRequest._networkRetried) {
            originalRequest._networkRetried = true;
            await new Promise((resolve) => setTimeout(resolve, 800));
            return apiClient(originalRequest);
        }

        const isAuthRequest = String(originalRequest.url || '').includes('/users/');
        const refreshToken = localStorage.getItem('refreshToken');
        if (error.response?.status === 401 && !isAuthRequest && !originalRequest._retry && refreshToken) {
            originalRequest._retry = true;
            if (!refreshPromise) {
                refreshPromise = axios.post(`${apiBaseURL}/users/refresh`, { refreshToken })
                    .then((response) => {
                        const newToken = response?.data?.token;
                        if (!newToken) throw new Error('刷新响应中没有访问令牌');
                        localStorage.setItem('token', newToken);
                        return newToken;
                    })
                    .finally(() => { refreshPromise = null; });
            }
            try {
                const newToken = await refreshPromise;
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                clearSession();
                if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        if (error.response?.status === 401) {
            clearSession();
            if (!window.location.pathname.startsWith('/login')) window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default apiClient;
