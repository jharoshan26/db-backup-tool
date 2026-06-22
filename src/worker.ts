import { Worker, Job, ConnectionOptions } from 'bullmq';
import { createRedis } from '@/lib/redis';
import { config } from '@/config';
import { logger } from '@/lib/logger';
import { QUEUE_NAMES } from '@/queue/types';
import { backupProcessor } from '@/worker/processors/backup.processor';
import { restoreProcessor } from '@/worker/processors/restore.processor';
import { exportProcessor } from '@/worker/processors/export.processor';
import { importProcessor } from '@/worker/processors/import.processor';
import { cloneProcessor } from '@/worker/processors/clone.processor';
import { disconnectPrisma } from '@/lib/prisma';

const connection = createRedis() as unknown as ConnectionOptions;
const concurrency = config.worker.concurrency;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const processors: Record<string, (job: Job<any>) => Promise<void>> = {
  [QUEUE_NAMES.backup]: backupProcessor,
  [QUEUE_NAMES.restore]: restoreProcessor,
  [QUEUE_NAMES.export]: exportProcessor,
  [QUEUE_NAMES.import]: importProcessor,
  [QUEUE_NAMES.clone]: cloneProcessor,
};

const workers: Worker[] = [];

for (const [name, processor] of Object.entries(processors)) {
  const worker = new Worker(name, processor, { connection, concurrency });
  worker.on('completed', (job) => logger.info({ queue: name, jobId: job.id }, 'job completed'));
  worker.on('failed', (job, err) => logger.error({ queue: name, jobId: job?.id, err }, 'job failed'));
  worker.on('error', (err) => logger.error({ queue: name, err }, 'worker error'));
  workers.push(worker);
  logger.info({ queue: name, concurrency }, 'worker started');
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down workers');
  await Promise.all(workers.map((w) => w.close()));
  await disconnectPrisma();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

logger.info('Worker process ready');
