import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

/**
 * Access token lives in memory only. The refresh token is an httpOnly cookie
 * scoped to /api/auth, so JS never sees it. On a 401 we refresh once
 * (concurrent requests share the same refresh promise) and retry.
 */
let accessToken: string | null = null;
let onAuthLost: (() => void) | null = null;

export const setAccessToken = (t: string | null) => { accessToken = t; };
export const getAccessToken = () => accessToken;
export const setOnAuthLost = (fn: () => void) => { onAuthLost = fn; };

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
  timeout: 70000, // free-tier hosts can take ~50 s to wake from sleep
});

api.interceptors.request.use((cfg) => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

let refreshing: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = axios
      .post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true, timeout: 70000 })
      .then((r) => {
        const t = r.data?.data?.accessToken ?? null;
        setAccessToken(t);
        return t;
      })
      .catch(() => {
        setAccessToken(null);
        return null;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

type RetryCfg = InternalAxiosRequestConfig & { _retry?: boolean };

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const cfg = error.config as RetryCfg | undefined;
    const isAuthCall = cfg?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && cfg && !cfg._retry && !isAuthCall) {
      cfg._retry = true;
      const t = await refreshAccessToken();
      if (t) return api(cfg);
      onAuthLost?.();
    }
    return Promise.reject(error);
  },
);

/** Pulls a human-readable message out of our error envelope. */
export function apiError(e: unknown, fallback = 'Something went wrong'): string {
  const err = e as AxiosError<{ error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } } }>;
  if (!err?.response) return err?.message === 'Network Error' ? 'Cannot reach the server. Is the backend running?' : fallback;
  const data = err.response.data?.error;
  const field = data?.details?.fieldErrors && Object.entries(data.details.fieldErrors)[0];
  return field ? `${field[0]}: ${field[1][0]}` : data?.message ?? fallback;
}

/** Unwraps { success, data } */
export const unwrap = <T,>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);
