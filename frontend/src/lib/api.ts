import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { authStore } from '@/store/auth';

export const API_BASE = '/api/v1';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // send the httpOnly refresh cookie
  headers: { 'Content-Type': 'application/json' },
});

// --- Request interceptor: attach bearer token ------------------------------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = authStore.getToken();
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

// --- Response interceptor: 401 -> refresh once, then retry ------------------
interface RetriableConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    // Bare axios (not `api`) so we don't recurse through the interceptor.
    const res = await axios.post<{ accessToken: string }>(
      `${API_BASE}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    const token = res.data.accessToken;
    authStore.setToken(token);
    return token;
  } catch {
    authStore.clear();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const isAuthEndpoint = original?.url?.includes('/auth/');

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      // De-dupe concurrent refreshes.
      refreshing = refreshing ?? refreshAccessToken();
      const newToken = await refreshing;
      refreshing = null;

      if (newToken) {
        original.headers = {
          ...original.headers,
          Authorization: `Bearer ${newToken}`,
        };
        return api(original);
      }

      // Refresh failed: bounce to login.
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  },
);

/** Normalise an API/Axios error into a human-readable string. */
export function apiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}
