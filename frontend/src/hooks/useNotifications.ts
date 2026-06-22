import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { qk } from './queryKeys';
import type { Notification } from '@/types';

export function useNotifications() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: qk.notifications,
    enabled: !!token,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await api.get<{ data: Notification[] } | Notification[]>('/notifications');
      return Array.isArray(data) ? data : data.data;
    },
  });
}
