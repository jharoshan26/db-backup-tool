import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE } from '@/lib/api';
import { authStore } from '@/store/auth';
import { qk } from './queryKeys';
import type { Backup, Paginated, RestoreInput } from '@/types';

export function useBackups() {
  return useQuery({
    queryKey: qk.backups,
    queryFn: async () => {
      const { data } = await api.get<Paginated<Backup>>('/backups');
      return data;
    },
  });
}

export function useBackup(id: string | undefined) {
  return useQuery({
    queryKey: qk.backup(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get<Backup>(`/backups/${id}`);
      return data;
    },
  });
}

export function useRestore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ backupId, input }: { backupId: string; input: RestoreInput }) => {
      const { data } = await api.post(`/backups/${backupId}/restore`, input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.jobs }),
  });
}

/**
 * Downloads a backup artifact. Uses an authenticated blob fetch so the bearer
 * token is attached, then triggers a browser save.
 */
export async function downloadBackup(backup: Backup): Promise<void> {
  const res = await fetch(`${API_BASE}/backups/${backup.id}/download`, {
    headers: { Authorization: `Bearer ${authStore.getToken() ?? ''}` },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${backup.database}-${backup.id}.${backup.format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
