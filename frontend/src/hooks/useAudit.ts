import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from './queryKeys';
import type { AuditEntry, Paginated } from '@/types';

export interface AuditParams {
  q?: string;
  page?: number;
  pageSize?: number;
}

export function useAudit(params: AuditParams) {
  return useQuery({
    queryKey: qk.audit(params),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data } = await api.get<Paginated<AuditEntry>>('/audit', { params });
      return data;
    },
  });
}
