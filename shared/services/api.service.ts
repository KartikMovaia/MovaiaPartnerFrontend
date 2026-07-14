// Shared HTTP client for the partners API. Bearer-token auth (no cookies/CSRF):
// the access + refresh tokens live in localStorage; the access token is attached
// to every request, and a 401 triggers a single refresh + replay.
import axios, { AxiosRequestConfig } from 'axios';

const ACCESS = 'mv_access';
const REFRESH = 'mv_refresh';
const DEVICE = 'mv_device';

// Staff tokens (partner admins + Movaia staff).
export const tokens = {
  access: () => localStorage.getItem(ACCESS),
  refresh: () => localStorage.getItem(REFRESH),
  set: (accessToken: string, refreshToken: string) => {
    localStorage.setItem(ACCESS, accessToken);
    localStorage.setItem(REFRESH, refreshToken);
  },
  clear: () => {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

// Kiosk device token (separate credential; bound iPad). No refresh — a 401 sends
// the kiosk back to the setup screen.
export const deviceToken = {
  get: () => localStorage.getItem(DEVICE),
  set: (t: string) => localStorage.setItem(DEVICE, t),
  clear: () => localStorage.removeItem(DEVICE),
};

const baseURL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  const t = tokens.access();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// Single-flight refresh: the first 401 rotates the tokens via /refresh, then the
// original request is replayed once. Auth endpoints are excluded so a bad
// login/refresh can't recurse.
let refreshing: Promise<string> | null = null;
function isAuthPath(url = ''): boolean {
  return /\/partner-auth\/(login|staff-login|refresh)$/.test(url);
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const rt = tokens.refresh();
    if (err.response?.status === 401 && original && !original._retried && !isAuthPath(original.url) && rt) {
      original._retried = true;
      try {
        refreshing =
          refreshing ||
          api
            .post('/partner-auth/refresh', { refreshToken: rt })
            .then((res) => {
              tokens.set(res.data.accessToken, res.data.refreshToken);
              return res.data.accessToken as string;
            })
            .finally(() => {
              refreshing = null;
            });
        const newAccess = await refreshing;
        original.headers = { ...original.headers, Authorization: `Bearer ${newAccess}` };
        return api(original); // replay with the fresh token
      } catch {
        tokens.clear(); // refresh failed — route guards will redirect to login
      }
    }
    return Promise.reject(err);
  }
);

// Kiosk client — attaches the device token instead of the staff token.
export const kioskApi = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });
kioskApi.interceptors.request.use((config) => {
  const t = deviceToken.get();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
