import { prisma } from '@/lib/prisma';
import { getStorage, uriToKey } from '@/lib/storage';
import { logger } from '@/lib/logger';

/**
 * Enforce a schedule's retention policy: keep the N most recent available backups
 * for the (server, database) pair; delete the rest from storage and mark them deleted.
 */
export async function enforceRetention(params: {
  tenantId: string;
  serverId: string;
  database: string;
  retention: number;
}): Promise<number> {
  const backups = await prisma.backup.findMany({
    where: { tenantId: params.tenantId, serverId: params.serverId, database: params.database, status: 'available', format: 'sql' },
    orderBy: { createdAt: 'desc' },
  });
  const toDelete = backups.slice(params.retention);
  let deleted = 0;
  for (const b of toDelete) {
    try {
      if (b.storageUri) await getStorage().delete(uriToKey(b.storageUri));
      await prisma.backup.update({ where: { id: b.id }, data: { status: 'deleted' } });
      deleted++;
    } catch (err) {
      logger.warn({ err, backupId: b.id }, 'retention: failed to delete backup');
    }
  }
  return deleted;
}
