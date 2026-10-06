import axios from 'axios';
import { getToken, clearSession } from './authStorage';

// Kết nối tới Backend API (mặc định port 4000)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Tự động gắn JWT vào mọi request API
axiosClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Nếu token hết hạn / không hợp lệ → đăng xuất về trang đăng nhập
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const isLoginRequest = error.config && error.config.url && error.config.url.includes('/auth/login');
      if (!isLoginRequest) {
        clearSession();
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (username, password) => axiosClient.post('/auth/login', { username, password }),
  me: () => axiosClient.get('/auth/me'),
};

export const deviceApi = {
  getAll: () => axiosClient.get('/devices'),
  sendCommand: (id, action) => axiosClient.post(`/devices/${id}/command`, { action }),
  setBrightness: (id, brightness) => axiosClient.post(`/devices/${id}/command`, { brightness }),
  create: (data) => axiosClient.post('/devices', data),
  update: (id, data) => axiosClient.put(`/devices/${id}`, data),
  delete: (id) => axiosClient.delete(`/devices/${id}`),
};

export const sensorApi = {
  getLatest: () => axiosClient.get('/sensors/latest'),
  getHistory: (nodeId, limit = 50) => axiosClient.get(`/sensors/history?nodeId=${nodeId}&limit=${limit}`),
};

export const automationApi = {
  getAll: () => axiosClient.get('/automations'),
  create: (data) => axiosClient.post('/automations', data),
  toggle: (id) => axiosClient.put(`/automations/${id}/toggle`),
  delete: (id) => axiosClient.delete(`/automations/${id}`),
};

export const scheduleApi = {
  getAll: () => axiosClient.get('/schedules'),
  create: (data) => axiosClient.post('/schedules', data),
  update: (id, data) => axiosClient.put(`/schedules/${id}`, data),
  toggle: (id) => axiosClient.put(`/schedules/${id}/toggle`),
  delete: (id) => axiosClient.delete(`/schedules/${id}`),
};

export const logApi = {
  getAll: () => axiosClient.get('/logs'),
};

// Quản lý người dùng - CHỈ admin mới dùng được (backend tự kiểm tra 403)
export const userApi = {
  getAll: () => axiosClient.get('/users'),
  create: (data) => axiosClient.post('/users', data),
  update: (id, data) => axiosClient.put(`/users/${id}`, data),
  delete: (id) => axiosClient.delete(`/users/${id}`),
};

export default axiosClient;
