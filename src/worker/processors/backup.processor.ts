import { Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { getAdapter } from '@/modules/servers/serverService';
import { HashingStream } from '@/lib/hashStream';
import { markRunning, updateProgress, markDone, markFailed } from '@/modules/jobs/jobService';
import { notifyJobOutcome } from '@/modules/notifications/notificationService';
import { audit } from '@/audit/audit';
import { logger } from '@/lib/logger';
import type { BackupJobData } from '@/queue/types';

export async function backupProcessor(job: Job<BackupJobData>): Promise<void> {
  const { jobId, tenantId, serverId, database } = job.data;
  const adapter = await getAdapter(serverId, tenantId, database);
  try {
    await markRunning(jobId);
    await updateProgress(jobId, 5, `Starting backup of ${database}`);

    const key = `tenants/${tenantId}/backups/${jobId}/${database}.sql`;
    const { stream, done } = await adapter.dump({ database });

    const hasher = new HashingStream();
    stream.pipe(hasher);

    await updateProgress(jobId, 30, 'Streaming dump to storage');
    const [putResult] = await Promise.all([getStorage().put(key, hasher), done]);

    const checksum = hasher.digest();
    const size = BigInt(hasher.bytes || putResult.size);

    const backup = await prisma.backup.create({
      data: {
        tenantId,
        serverId,
        jobId,
        database,
        format: 'sql',
        status: 'available',
        size,
        storageUri: putResult.uri,
        checksum,
      },
    });

    await markDone(jobId, { backupId: backup.id, size: Number(size), checksum, storageUri: putResult.uri });
    await audit({
      tenantId,
      action: 'backup.completed',
      target: `server:${serverId}`,
      meta: { database, backupId: backup.id, size: Number(size) },
    });
    await notifyJobOutcome(jobId, true, `Backup of ${database} completed (${Number(size)} bytes).`);
  } catch (err) {
    logger.error({ err, jobId }, 'backup failed');
    await markFailed(jobId, (err as Error).message);
    await audit({ tenantId, action: 'backup.failed', target: `server:${serverId}`, meta: { database, error: (err as Error).message } });
    await notifyJobOutcome(jobId, false, `Backup of ${database} failed: ${(err as Error).message}`);
    throw err;
  } finally {
    await adapter.close();
  }
}
