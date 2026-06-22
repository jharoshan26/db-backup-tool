import { Queue, JobsOptions, ConnectionOptions } from 'bullmq';
import { createRedis, redis } from '@/lib/redis';
import { QUEUE_NAMES, QueueName } from './types';

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

// Cast around the duplicated ioredis types that bullmq bundles internally.
const connection = createRedis() as unknown as ConnectionOptions;

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, { connection, defaultJobOptions });
    queues.set(name, q);
  }
  return q;
}

/** Enqueue a job. `jobKey` (when provided) makes the enqueue idempotent. */
export async function enqueue<T>(
  name: QueueName,
  data: T,
  opts?: { jobKey?: string; delay?: number; repeat?: { pattern: string }; jobId?: string },
): Promise<string> {
  const q = getQueue(name);
  const job = await q.add(name, data, {
    jobId: opts?.jobId ?? opts?.jobKey,
    delay: opts?.delay,
    repeat: opts?.repeat,
  });
  return job.id as string;
}

export { QUEUE_NAMES };

// ---- Progress pub/sub ----
// Workers publish progress to `job:{id}`; the API subscribes and streams to clients via SSE.

export interface JobProgressEvent {
  jobId: string;
  status: string;
  progress: number;
  message?: string;
  result?: unknown;
  error?: string;
}

export async function publishProgress(ev: JobProgressEvent): Promise<void> {
  await redis.publish(`job:${ev.jobId}`, JSON.stringify(ev));
}

/** Subscribe to a single job's progress channel. Returns an unsubscribe function. */
export function subscribeProgress(jobId: string, onEvent: (ev: JobProgressEvent) => void): () => void {
  const sub = createRedis();
  const channel = `job:${jobId}`;
  sub.subscribe(channel).catch(() => undefined);
  sub.on('message', (_chan, payload) => {
    try {
      onEvent(JSON.parse(payload) as JobProgressEvent);
    } catch {
      /* ignore malformed */
    }
  });
  return () => {
    sub.unsubscribe(channel).catch(() => undefined);
    sub.quit().catch(() => undefined);
  };
}
