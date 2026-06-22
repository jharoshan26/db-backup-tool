import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, parseBody } from '@/api/http';
import { authenticate, requirePermission } from '@/auth/middleware';
import type { AuthedRequest } from '@/auth/context';
import { createJob } from '@/modules/jobs/jobService';
import { enqueue, QUEUE_NAMES } from '@/queue';
import { getStorage, uriToKey } from '@/lib/storage';
import { audit } from '@/audit/audit';
import { NotFound } from '@/lib/errors';

export const backupsRouter = Router();
backupsRouter.use(authenticate);

function publicBackup(b: {
  id: string; serverId: string; database: string; format: string; status: string; size: bigint; storageUri: string | null; checksum: string | null; createdAt: Date; jobId: string | null;
}) {
  return { id: b.id, serverId: b.serverId, database: b.database, format: b.format, status: b.status, size: Number(b.size), storageUri: b.storageUri, checksum: b.checksum, jobId: b.jobId, createdAt: b.createdAt };
}

const runSchema = z.object({ database: z.string().min(1), format: z.literal('sql').optional() });

// Run a backup for a server.
backupsRouter.post(
  '/servers/:id/backups',
  requirePermission('backup:run'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { database } = parseBody(runSchema, req.body);
    const tenantId = req.auth!.tenantId;
    const server = await prisma.dbServer.findFirst({ where: { id: req.params.id, tenantId } });
    if (!server) throw NotFound('Server not found');

    const job = await createJob({ tenantId, type: 'backup', actorId: req.auth!.userId, params: { serverId: server.id, database } });
    await enqueue(QUEUE_NAMES.backup, { jobId: job.id, tenantId, serverId: server.id, database, format: 'sql' }, { jobId: job.id });
    await audit({ tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'backup.requested', target: `server:${server.id}`, meta: { database, jobId: job.id } });
    res.status(202).json({ id: job.id, type: job.type, status: job.status, progress: 0 });
  }),
);

backupsRouter.get(
  '/backups',
  requirePermission('backup:read'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const tenantId = req.auth!.tenantId;
    const [data, total] = await Promise.all([
      prisma.backup.findMany({ where: { tenantId, status: { not: 'deleted' } }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.backup.count({ where: { tenantId, status: { not: 'deleted' } } }),
    ]);
    res.json({ data: data.map(publicBackup), total });
  }),
);

backupsRouter.get(
  '/backups/:id',
  requirePermission('backup:read'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const backup = await prisma.backup.findFirst({ where: { id: req.params.id, tenantId: req.auth!.tenantId } });
    if (!backup) throw NotFound('Backup not found');
    res.json(publicBackup(backup));
  }),
);

backupsRouter.get(
  '/backups/:id/download',
  requirePermission('backup:read'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const backup = await prisma.backup.findFirst({ where: { id: req.params.id, tenantId: req.auth!.tenantId } });
    if (!backup?.storageUri) throw NotFound('Backup artifact not found');
    await audit({ tenantId: req.auth!.tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'backup.downloaded', target: `backup:${backup.id}` });
    const ext = backup.format === 'sql' ? 'sql' : backup.format;
    res.setHeader('Content-Disposition', `attachment; filename="${backup.database}-${backup.id}.${ext}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const stream = await getStorage().get(uriToKey(backup.storageUri));
    stream.pipe(res);
  }),
);

const restoreSchema = z.object({
  targetServerId: z.string().uuid(),
  targetDatabase: z.string().min(1),
  createDatabase: z.boolean().optional().default(true),
});

backupsRouter.post(
  '/backups/:id/restore',
  requirePermission('restore:run'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = parseBody(restoreSchema, req.body);
    const tenantId = req.auth!.tenantId;
    const backup = await prisma.backup.findFirst({ where: { id: req.params.id, tenantId } });
    if (!backup) throw NotFound('Backup not found');
    const target = await prisma.dbServer.findFirst({ where: { id: input.targetServerId, tenantId } });
    if (!target) throw NotFound('Target server not found');

    const job = await createJob({ tenantId, type: 'restore', actorId: req.auth!.userId, params: { backupId: backup.id, ...input } });
    await enqueue(
      QUEUE_NAMES.restore,
      { jobId: job.id, tenantId, backupId: backup.id, targetServerId: input.targetServerId, targetDatabase: input.targetDatabase, createDatabase: input.createDatabase },
      { jobId: job.id },
    );
    await audit({ tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'restore.requested', target: `backup:${backup.id}`, meta: { ...input, jobId: job.id } });
    res.status(202).json({ id: job.id, type: job.type, status: job.status, progress: 0 });
  }),
);
