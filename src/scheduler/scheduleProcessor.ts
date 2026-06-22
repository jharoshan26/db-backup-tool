import { Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { createJob } from '@/modules/jobs/jobService';
import { enqueue, QUEUE_NAMES } from '@/queue';
import { enforceRetention } from './retention';
import { audit } from '@/audit/audit';
import { logger } from '@/lib/logger';

interface TriggerData {
  scheduleId: string;
  tenantId: string;
}

/** Fired by the repeatable cron job: create a backup job and enforce retention. */
export async function scheduleProcessor(job: Job<TriggerData>): Promise<void> {
  const { scheduleId } = job.data;
  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } });
  if (!schedule || !schedule.enabled) {
    logger.info({ scheduleId }, 'schedule missing or disabled — skipping');
    return;
  }

  const backupJob = await createJob({
    tenantId: schedule.tenantId,
    type: 'backup',
    scheduleId: schedule.id,
    params: { serverId: schedule.serverId, database: schedule.database, scheduled: true },
  });
  await enqueue(
    QUEUE_NAMES.backup,
    { jobId: backupJob.id, tenantId: schedule.tenantId, serverId: schedule.serverId, database: schedule.database, format: 'sql' },
    { jobId: backupJob.id },
  );
  await prisma.schedule.update({ where: { id: schedule.id }, data: { lastRunAt: new Date() } });
  await audit({ tenantId: schedule.tenantId, action: 'schedule.triggered', target: `schedule:${schedule.id}`, meta: { jobId: backupJob.id, database: schedule.database } });

  // Retention runs opportunistically; it acts on already-completed backups.
  const removed = await enforceRetention({
    tenantId: schedule.tenantId,
    serverId: schedule.serverId,
    database: schedule.database,
    retention: schedule.retention,
  });
  if (removed > 0) logger.info({ scheduleId, removed }, 'retention enforced');
}
