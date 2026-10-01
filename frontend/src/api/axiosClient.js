import axios from 'axios';

// Kết nối tới Backend API (mặc định port 4000)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const deviceApi = {
  getAll: () => axiosClient.get('/devices'),
  sendCommand: (id, action) => axiosClient.post(`/devices/${id}/command`, { action }),
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

export const logApi = {
  getAll: () => axiosClient.get('/logs'),
};

export default axiosClient;
