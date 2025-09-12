import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5432';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.log('🔄 Authentication failed, clearing stored data...');
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      
      // Reload the page to show login screen
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  register: async (username, password) => {
    const response = await api.post('/api/auth/register', { username, password });
    return response.data;
  },

  login: async (username, password) => {
    const response = await api.post('/api/auth/login', { username, password });
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/api/auth/logout');
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  getUsers: async () => {
    const response = await api.get('/api/auth/friends');
    // Map MongoDB _id to id if needed
    if (response.data.success && response.data.data.friends) {
      response.data.data.friends = response.data.data.friends.map(friend => ({
        id: friend.id || friend._id,
        username: friend.username,
        isOnline: friend.isOnline || false,
        lastSeen: friend.lastSeen
      }));
    }
    return response.data;
  },

  addFriend: async (secretId) => {
    const response = await api.post('/api/auth/add-friend', { secretId });
    return response.data;
  },

  validatePassword: async (password) => {
    const response = await api.post('/api/auth/validate-password', { password });
    return response.data;
  },
};

// Utility functions
export const setAuthToken = (token) => {
  localStorage.setItem('authToken', token);
};

export const removeAuthToken = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
};

export const getCurrentUser = () => {
  const userStr = localStorage.getItem('currentUser');
  return userStr ? JSON.parse(userStr) : null;
};

export const setCurrentUser = (user) => {
  localStorage.setItem('currentUser', JSON.stringify(user));
};

export default api;
