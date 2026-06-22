import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  setAuth: (accessToken: string, user: User) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  clear: () => void;
  hasPermission: (perm: string) => boolean;
}

/**
 * Auth store. The access token is kept in-memory + persisted to localStorage so a
 * page refresh keeps the session until the token expires (refresh is handled by the
 * axios interceptor via the httpOnly refresh cookie).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => set({ accessToken, user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ accessToken: null, user: null }),
      hasPermission: (perm) => {
        const perms = get().user?.permissions ?? [];
        // `*` acts as a wildcard super-permission.
        return perms.includes('*') || perms.includes(perm);
      },
    }),
    {
      name: 'dbbackup.auth',
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
    },
  ),
);

// Non-hook accessors so non-React modules (axios interceptors) can read/write auth.
export const authStore = {
  getToken: () => useAuthStore.getState().accessToken,
  setToken: (token: string) => useAuthStore.getState().setAccessToken(token),
  clear: () => useAuthStore.getState().clear(),
};
