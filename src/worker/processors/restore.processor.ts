import { Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { getStorage, uriToKey } from '@/lib/storage';
import { getAdapter } from '@/modules/servers/serverService';
import { markRunning, updateProgress, markDone, markFailed } from '@/modules/jobs/jobService';
import { notifyJobOutcome } from '@/modules/notifications/notificationService';
import { audit } from '@/audit/audit';
import { logger } from '@/lib/logger';
import { NotFound } from '@/lib/errors';
import type { RestoreJobData } from '@/queue/types';

export async function restoreProcessor(job: Job<RestoreJobData>): Promise<void> {
  const { jobId, tenantId, backupId, targetServerId, targetDatabase, createDatabase } = job.data;
  const adapter = await getAdapter(targetServerId, tenantId, targetDatabase);
  try {
    await markRunning(jobId);
    const backup = await prisma.backup.findFirst({ where: { id: backupId, tenantId } });
    if (!backup?.storageUri) throw NotFound('Backup artifact not found');

    await updateProgress(jobId, 20, 'Fetching backup artifact');
    const input = await getStorage().get(uriToKey(backup.storageUri));

    await updateProgress(jobId, 40, `Restoring into ${targetDatabase}`);
    await adapter.restore(input, { database: targetDatabase, createDatabase });

    await markDone(jobId, { targetServerId, targetDatabase });
    await audit({
      tenantId,
      action: 'restore.completed',
      target: `server:${targetServerId}`,
      meta: { backupId, targetDatabase },
    });
    await notifyJobOutcome(jobId, true, `Restore into ${targetDatabase} completed.`);
  } catch (err) {
    logger.error({ err, jobId }, 'restore failed');
    await markFailed(jobId, (err as Error).message);
    await audit({ tenantId, action: 'restore.failed', target: `server:${targetServerId}`, meta: { backupId, error: (err as Error).message } });
    await notifyJobOutcome(jobId, false, `Restore failed: ${(err as Error).message}`);
    throw err;
  } finally {
    await adapter.close();
  }
}
