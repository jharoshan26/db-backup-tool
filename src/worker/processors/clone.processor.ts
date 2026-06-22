import { Job } from 'bullmq';
import { getAdapter } from '@/modules/servers/serverService';
import { markRunning, updateProgress, markDone, markFailed } from '@/modules/jobs/jobService';
import { notifyJobOutcome } from '@/modules/notifications/notificationService';
import { audit } from '@/audit/audit';
import { logger } from '@/lib/logger';
import type { CloneJobData } from '@/queue/types';

/**
 * Clone/migrate a database by streaming a logical dump from the source directly into
 * the target's restore process — no full artifact is staged on disk.
 */
export async function cloneProcessor(job: Job<CloneJobData>): Promise<void> {
  const { jobId, tenantId, sourceServerId, targetServerId, database, targetDatabase, mode } = job.data;
  const source = await getAdapter(sourceServerId, tenantId, database);
  const target = await getAdapter(targetServerId, tenantId, targetDatabase);
  try {
    await markRunning(jobId);
    await updateProgress(jobId, 15, `Dumping ${database} from source`);

    const { stream, done } = await source.dump({ database, schemaOnly: mode === 'schema' });

    await updateProgress(jobId, 50, `Restoring into ${targetDatabase} on target`);
    await Promise.all([target.restore(stream, { database: targetDatabase, createDatabase: true }), done]);

    await markDone(jobId, { targetServerId, targetDatabase, mode });
    await audit({
      tenantId,
      action: 'clone.completed',
      target: `server:${targetServerId}`,
      meta: { sourceServerId, database, targetDatabase, mode },
    });
    await notifyJobOutcome(jobId, true, `Clone of ${database} → ${targetDatabase} completed.`);
  } catch (err) {
    logger.error({ err, jobId }, 'clone failed');
    await markFailed(jobId, (err as Error).message);
    await audit({ tenantId, action: 'clone.failed', target: `server:${targetServerId}`, meta: { database, error: (err as Error).message } });
    await notifyJobOutcome(jobId, false, `Clone failed: ${(err as Error).message}`);
    throw err;
  } finally {
    await source.close();
    await target.close();
  }
}
