import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from './queryKeys';
import type { Paginated, Schedule, ScheduleInput } from '@/types';

export function useSchedules() {
  return useQuery({
    queryKey: qk.schedules,
    queryFn: async () => {
      const { data } = await api.get<Paginated<Schedule>>('/schedules');
      return data;
    },
  });
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleInput) => {
      const { data } = await api.post<Schedule>('/schedules', input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.schedules }),
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<ScheduleInput> }) => {
      const { data } = await api.patch<Schedule>(`/schedules/${id}`, input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.schedules }),
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/schedules/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.schedules }),
  });
}
