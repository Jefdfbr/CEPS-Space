import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000, // 10 segundos timeout
  withCredentials: false, // Mudará para true quando implementar CSRF tokens
  headers: {
    'Content-Type': 'application/json',
  }
});

// Sanitização de dados antes de enviar
const sanitizeData = (data) => {
  if (typeof data === 'string') {
    return data.replace(/[<>]/g, '');
  }
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    for (const key in data) {
      if (typeof data[key] === 'string') {
        sanitized[key] = data[key].replace(/[<>]/g, '');
      } else {
        sanitized[key] = data[key];
      }
    }
    return sanitized;
  }
  return data;
};

// Interceptor para adicionar token de autenticação e sanitizar dados
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Sanitizar dados de POST/PUT
  if (config.data && (config.method === 'post' || config.method === 'put')) {
    config.data = sanitizeData(config.data);
  }
  
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor de resposta para tratamento de erros
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Logout automático em caso de token inválido
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);
export const getProfile = () => api.get('/protected/profile');

// Games
export const getGames = () => api.get('/games');
export const getGame = (id) => api.get(`/games/${id}`);
export const createGame = (data) => api.post('/protected/games', data);
export const getMyGames = () => api.get('/protected/games/my');
export const deleteGame = (id) => api.delete(`/protected/games/${id}`);

// Word Search
export const getWordSearchConfig = (gameId) => api.get(`/word-search/${gameId}`);
export const createWordSearchConfig = (data) => api.post('/protected/word-search', data);
export const updateWordSearchConfig = (gameId, data) => api.put(`/protected/word-search/${gameId}`, data);

// Quiz
export const getQuizConfig = (gameId) => api.get(`/quiz/${gameId}`);
export const getQuizQuestions = (gameId) => api.get(`/quiz/${gameId}/questions`);
export const createQuizConfig = (data) => api.post('/protected/quiz', data);

// Sessions
export const getSession = (code) => api.get(`/sessions/${code}`);
export const joinSession = (data) => api.post('/sessions/join', data);
export const createSession = (data) => api.post('/protected/sessions', data);
export const startSession = (id) => api.post(`/protected/sessions/${id}/start`);
export const endSession = (id) => api.post(`/protected/sessions/${id}/end`);
export const submitScore = (data) => api.post('/scores', data);
export const getSessionResults = (sessionId) => api.get(`/sessions/${sessionId}/results`);

export default api;
