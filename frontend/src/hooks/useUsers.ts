import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from './queryKeys';
import type { Paginated, Role, User } from '@/types';

export function useUsers() {
  return useQuery({
    queryKey: qk.users,
    queryFn: async () => {
      const { data } = await api.get<Paginated<User>>('/users');
      return data;
    },
  });
}

export function useRoles() {
  return useQuery({
    queryKey: qk.roles,
    queryFn: async () => {
      const { data } = await api.get<{ data: Role[] } | Role[]>('/roles');
      return Array.isArray(data) ? data : data.data;
    },
  });
}

export interface CreateUserInput {
  email: string;
  name?: string;
  password?: string;
  roleId?: string;
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const { data } = await api.post<User>('/users', input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<CreateUserInput> }) => {
      const { data } = await api.patch<User>(`/users/${id}`, input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }),
  });
}

export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const { data } = await api.post<User>(`/users/${userId}/roles`, { roleId });
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }),
  });
}
