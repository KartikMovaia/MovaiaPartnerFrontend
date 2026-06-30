// Central axios instance. Injects the staff bearer token and clears it on 401.
// Ported from Movaia's api.service.ts (refresh-token rotation can be added the
// same way later).
import axios from 'axios';

const TOKEN_KEY = 'movaia_partner_token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
});

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      tokenStore.clear();
      // Let route guards redirect to the appropriate login.
    }
    return Promise.reject(err);
  }
);
