import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from './queryKeys';
import type {
  CloneInput,
  ExportInput,
  Paginated,
  RunBackupInput,
  Server,
  ServerCreateInput,
  ServerUpdateInput,
  TestConnectionResult,
} from '@/types';

export function useServers() {
  return useQuery({
    queryKey: qk.servers,
    queryFn: async () => {
      const { data } = await api.get<Paginated<Server>>('/servers');
      return data;
    },
  });
}

export function useServer(id: string | undefined) {
  return useQuery({
    queryKey: qk.server(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get<Server>(`/servers/${id}`);
      return data;
    },
  });
}

export function useServerDatabases(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: qk.serverDatabases(id ?? ''),
    enabled: !!id && enabled,
    queryFn: async () => {
      const { data } = await api.get<{ databases: string[] }>(`/servers/${id}/databases`);
      return data.databases;
    },
  });
}

export function useCreateServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ServerCreateInput) => {
      const { data } = await api.post<Server>('/servers', input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.servers }),
  });
}

export function useUpdateServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: ServerUpdateInput }) => {
      const { data } = await api.patch<Server>(`/servers/${id}`, input);
      return data;
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: qk.servers });
      qc.invalidateQueries({ queryKey: qk.server(id) });
    },
  });
}

export function useDeleteServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/servers/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.servers }),
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<TestConnectionResult>(`/servers/${id}/test`);
      return data;
    },
  });
}

export function useRunBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ serverId, input }: { serverId: string; input: RunBackupInput }) => {
      const { data } = await api.post(`/servers/${serverId}/backups`, input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.backups });
      qc.invalidateQueries({ queryKey: qk.jobs });
    },
  });
}

export function useExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ serverId, input }: { serverId: string; input: ExportInput }) => {
      const { data } = await api.post(`/servers/${serverId}/export`, input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.jobs }),
  });
}

export function useClone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CloneInput) => {
      const { data } = await api.post('/clone', input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.jobs }),
  });
}
