import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from './queryKeys';
import type { ImportInput } from '@/types';

export function useImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ImportInput) => {
      const { data } = await api.post('/imports', input);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.jobs }),
  });
}

/** Reads a File into a base64 string (without the data: URL prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
