import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, API_BASE } from '@/lib/api';
import { authStore } from '@/store/auth';
import { qk } from './queryKeys';
import type { Job, JobProgressEvent, Paginated } from '@/types';

export function useJobs(options?: { poll?: boolean }) {
  return useQuery({
    queryKey: qk.jobs,
    queryFn: async () => {
      const { data } = await api.get<Paginated<Job>>('/jobs');
      return data;
    },
    // Keep the list fresh while jobs are in flight.
    refetchInterval: options?.poll ? 4000 : false,
  });
}

export function useJob(id: string | undefined) {
  return useQuery({
    queryKey: qk.job(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data } = await api.get<Job>(`/jobs/${id}`);
      return data;
    },
  });
}

const TERMINAL: Job['status'][] = ['done', 'failed'];

/**
 * Live job tracking. Prefers SSE (`/jobs/:id/stream`); if the EventSource errors
 * before completing, it falls back to polling GET /jobs/:id every 2s.
 *
 * Note: EventSource cannot send Authorization headers, so the token is passed as a
 * query param; the backend should accept it there for the stream endpoint. The
 * polling fallback uses the normal authenticated axios client.
 */
export function useJobStream(id: string | undefined) {
  const [job, setJob] = useState<Job | null>(null);
  const [transport, setTransport] = useState<'sse' | 'poll' | 'idle'>('idle');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let es: EventSource | null = null;

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const fetchOnce = async () => {
      try {
        const { data } = await api.get<Job>(`/jobs/${id}`);
        if (cancelled) return;
        setJob(data);
        if (TERMINAL.includes(data.status)) stopPolling();
      } catch {
        /* keep polling */
      }
    };

    const startPolling = () => {
      if (pollRef.current) return;
      setTransport('poll');
      void fetchOnce();
      pollRef.current = setInterval(fetchOnce, 2000);
    };

    // Seed with current job state, then attempt SSE.
    void fetchOnce();

    try {
      const token = authStore.getToken();
      const url = `${API_BASE}/jobs/${id}/stream${token ? `?access_token=${encodeURIComponent(token)}` : ''}`;
      es = new EventSource(url, { withCredentials: true });

      es.onmessage = (evt) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(evt.data) as JobProgressEvent & Partial<Job>;
          setTransport('sse');
          setJob((prev) =>
            prev
              ? { ...prev, ...data, progress: data.progress ?? prev.progress, status: data.status ?? prev.status }
              : (data as Job),
          );
          if (data.status && TERMINAL.includes(data.status)) {
            es?.close();
            void fetchOnce(); // grab final result/error
          }
        } catch {
          /* ignore malformed frame */
        }
      };

      es.onerror = () => {
        es?.close();
        if (!cancelled) startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      cancelled = true;
      es?.close();
      stopPolling();
    };
  }, [id]);

  return { job, transport };
}
