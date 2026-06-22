import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { qk } from './queryKeys';
import type { LoginResponse, User } from '@/types';

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const { data } = await api.post<LoginResponse>('/auth/login', input);
      return data;
    },
    onSuccess: (data) => {
      setAuth(data.accessToken, data.user);
    },
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSettled: () => {
      clear();
      qc.clear();
    },
  });
}

/** Fetches the current user (and refreshes permissions) when a token exists. */
export function useMe() {
  const token = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: qk.me,
    enabled: !!token,
    queryFn: async () => {
      const { data } = await api.get<User>('/me');
      setUser(data);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
