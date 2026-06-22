import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, parseBody } from '@/api/http';
import { authenticate, requirePermission } from '@/auth/middleware';
import type { AuthedRequest } from '@/auth/context';
import { createJob } from '@/modules/jobs/jobService';
import { enqueue, QUEUE_NAMES } from '@/queue';
import { getStorage } from '@/lib/storage';
import { audit } from '@/audit/audit';
import { NotFound, BadRequest } from '@/lib/errors';

/** Routes for export, import, and clone — the data-movement operations. */
export const transferRouter = Router();
transferRouter.use(authenticate);

async function assertServer(tenantId: string, serverId: string) {
  const server = await prisma.dbServer.findFirst({ where: { id: serverId, tenantId } });
  if (!server) throw NotFound('Server not found');
  return server;
}

// ---- Export ----
const exportSchema = z.object({
  database: z.string().min(1),
  table: z.string().min(1),
  format: z.enum(['csv', 'xlsx', 'sql']),
});

transferRouter.post(
  '/servers/:id/export',
  requirePermission('export:run'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = parseBody(exportSchema, req.body);
    const tenantId = req.auth!.tenantId;
    await assertServer(tenantId, req.params.id);
    const job = await createJob({ tenantId, type: 'export', actorId: req.auth!.userId, params: { serverId: req.params.id, ...input } });
    await enqueue(QUEUE_NAMES.export, { jobId: job.id, tenantId, serverId: req.params.id, ...input }, { jobId: job.id });
    await audit({ tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'export.requested', target: `server:${req.params.id}`, meta: { ...input, jobId: job.id } });
    res.status(202).json({ id: job.id, type: job.type, status: job.status, progress: 0 });
  }),
);

// ---- Import ----
// Accepts a base64-encoded file for simplicity; it is staged to object storage,
// then a worker streams it into the target table.
const importSchema = z.object({
  serverId: z.string().uuid(),
  database: z.string().min(1),
  table: z.string().min(1),
  format: z.enum(['csv', 'xlsx']),
  fileBase64: z.string().min(1),
  options: z.object({ hasHeader: z.boolean().optional(), truncate: z.boolean().optional() }).optional(),
});

transferRouter.post(
  '/imports',
  requirePermission('import:run'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = parseBody(importSchema, req.body);
    const tenantId = req.auth!.tenantId;
    await assertServer(tenantId, input.serverId);

    const buffer = Buffer.from(input.fileBase64, 'base64');
    if (buffer.length === 0) throw BadRequest('Empty file');
    const fileKey = `tenants/${tenantId}/imports/${Date.now()}-${input.table}.${input.format}`;
    await getStorage().put(fileKey, buffer);

    const job = await createJob({ tenantId, type: 'import', actorId: req.auth!.userId, params: { serverId: input.serverId, database: input.database, table: input.table, format: input.format } });
    await enqueue(
      QUEUE_NAMES.import,
      { jobId: job.id, tenantId, serverId: input.serverId, database: input.database, table: input.table, format: input.format, fileKey, options: input.options },
      { jobId: job.id },
    );
    await audit({ tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'import.requested', target: `server:${input.serverId}`, meta: { database: input.database, table: input.table, format: input.format, jobId: job.id } });
    res.status(202).json({ id: job.id, type: job.type, status: job.status, progress: 0 });
  }),
);

// ---- Clone ----
const cloneSchema = z.object({
  sourceServerId: z.string().uuid(),
  targetServerId: z.string().uuid(),
  database: z.string().min(1),
  targetDatabase: z.string().min(1),
  mode: z.enum(['schema', 'full']).default('full'),
});

transferRouter.post(
  '/clone',
  requirePermission('clone:run'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = parseBody(cloneSchema, req.body);
    const tenantId = req.auth!.tenantId;
    await assertServer(tenantId, input.sourceServerId);
    await assertServer(tenantId, input.targetServerId);
    const job = await createJob({ tenantId, type: 'clone', actorId: req.auth!.userId, params: { ...input } });
    await enqueue(QUEUE_NAMES.clone, { jobId: job.id, tenantId, ...input }, { jobId: job.id });
    await audit({ tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'clone.requested', meta: { ...input, jobId: job.id } });
    res.status(202).json({ id: job.id, type: job.type, status: job.status, progress: 0 });
  }),
);
