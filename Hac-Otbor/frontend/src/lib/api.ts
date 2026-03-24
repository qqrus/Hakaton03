import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_URL,
});

// Request interceptor for Auth
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data: any) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  me: () => api.get('/users/me'),
  updateMe: (data: any) => api.put('/users/me', data),
  getUser: (id: number) => api.get(`/users/${id}`),
  getUsers: () => api.get('/users'),
};

export const eventApi = {
  getAll: () => api.get('/events'),
  join: (id: number) => api.post(`/events/${id}/join`),
  cancelParticipation: (id: number) => api.delete(`/events/${id}/participation`),
  create: (data: any) => api.post('/events', data),
  updateEvent: (id: number, data: any) => api.put(`/events/${id}`, data),
  getParticipants: (eventId: number) => api.get(`/events/${eventId}/participants`),
  confirmParticipation: (eventId: number, userId: number) => api.post(`/events/${eventId}/confirm/${userId}`),
  getEventQrUrl: (id: number) => `${api.defaults.baseURL}/events/${id}/qr`,
  getUserEvents: (userId: number) => api.get(`/users/${userId}/events`),
};

export const ratingApi = {
  getLeaderboard: () => api.get('/leaderboard'),
  getAiSummary: (userId: number) => api.get(`/users/${userId}/ai-summary`),
};

export default api;
