import { Worker, ConnectionOptions } from 'bullmq';
import { createRedis } from '@/lib/redis';
import { prisma, disconnectPrisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { QUEUE_NAMES } from '@/queue/types';
import { registerSchedule } from '@/scheduler/scheduleManager';
import { scheduleProcessor } from '@/scheduler/scheduleProcessor';

const connection = createRedis() as unknown as ConnectionOptions;

/** On boot, reconcile DB schedules into BullMQ repeatable jobs (idempotent). */
async function syncSchedules(): Promise<void> {
  const schedules = await prisma.schedule.findMany({ where: { enabled: true } });
  for (const s of schedules) {
    await registerSchedule(s);
  }
  logger.info({ count: schedules.length }, 'schedules synced');
}

async function main(): Promise<void> {
  await syncSchedules();

  const worker = new Worker(QUEUE_NAMES.schedule, scheduleProcessor, { connection });
  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'schedule trigger processed'));
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'schedule trigger failed'));
  logger.info('Scheduler process ready');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down scheduler');
    await worker.close();
    await disconnectPrisma();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'scheduler failed to start');
  process.exit(1);
});
