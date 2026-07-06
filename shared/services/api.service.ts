// Central axios instance. Auth is carried by an httpOnly cookie the browser
// sends automatically (see docs/contract-audit.md §4.2) — page JS never touches
// the token. We only (a) send credentials, (b) echo the readable CSRF cookie in
// a header on state-changing requests, and (c) transparently refresh once on 401.
import axios, { AxiosRequestConfig } from 'axios';

export const api = axios.create({
  // Defaults to a same-origin path so the auth cookie is first-party; the Vite
  // dev proxy forwards /api → the backend. Override with VITE_API_URL only if
  // you deliberately run cross-origin (then the cookie needs SameSite=None).
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// The CSRF token lives in a readable (non-httpOnly) cookie; mirror it into the
// X-CSRF-Token header so the backend's double-submit check passes.
function readCsrfCookie(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)mv_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const SAFE = new Set(['get', 'head', 'options']);

api.interceptors.request.use((config) => {
  if (!SAFE.has((config.method || 'get').toLowerCase())) {
    const csrf = readCsrfCookie();
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
});

// Single-flight refresh: on the first 401, try to rotate the access token from
// the refresh cookie, then replay the original request once. Auth endpoints are
// excluded so a failed login/refresh can't recurse.
let refreshing: Promise<unknown> | null = null;

function isAuthEndpoint(url = ''): boolean {
  return /\/partner-auth\/(login|staff-login|refresh)$/.test(url);
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    if (err.response?.status === 401 && original && !original._retried && !isAuthEndpoint(original.url)) {
      original._retried = true;
      try {
        refreshing = refreshing || api.post('/partner-auth/refresh').finally(() => (refreshing = null));
        await refreshing;
        return api(original); // replay with the freshly-issued cookies
      } catch {
        // refresh failed — fall through and let route guards redirect to login
      }
    }
    return Promise.reject(err);
  }
);
