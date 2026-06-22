import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, parseBody } from '@/api/http';
import { authenticate, requirePermission } from '@/auth/middleware';
import type { AuthedRequest } from '@/auth/context';
import { createServer, updateServerCredentialPassword, getAdapter } from '@/modules/servers/serverService';
import { audit } from '@/audit/audit';
import { NotFound } from '@/lib/errors';

export const serversRouter = Router();
serversRouter.use(authenticate);

function publicServer(s: { id: string; name: string; engine: string; host: string; port: number; sslMode: string; createdAt: Date }) {
  return { id: s.id, name: s.name, engine: s.engine, host: s.host, port: s.port, sslMode: s.sslMode, createdAt: s.createdAt };
}

const createSchema = z.object({
  name: z.string().min(1),
  engine: z.enum(['mysql', 'mariadb', 'postgres']),
  host: z.string().min(1),
  port: z.number().int().positive(),
  sslMode: z.enum(['disable', 'require', 'verify_full']).optional(),
  username: z.string().min(1),
  password: z.string().min(1),
  database: z.string().optional(),
});

serversRouter.get(
  '/',
  requirePermission('server:read'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const tenantId = req.auth!.tenantId;
    const [data, total] = await Promise.all([
      prisma.dbServer.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' } }),
      prisma.dbServer.count({ where: { tenantId } }),
    ]);
    res.json({ data: data.map(publicServer), total });
  }),
);

serversRouter.post(
  '/',
  requirePermission('server:create'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = parseBody(createSchema, req.body);
    const server = await createServer(req.auth!.tenantId, input);
    await audit({ tenantId: req.auth!.tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'server.created', target: `server:${server.id}`, meta: { name: input.name, engine: input.engine } });
    res.status(201).json(publicServer(server));
  }),
);

serversRouter.get(
  '/:id',
  requirePermission('server:read'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const server = await prisma.dbServer.findFirst({ where: { id: req.params.id, tenantId: req.auth!.tenantId } });
    if (!server) throw NotFound('Server not found');
    res.json(publicServer(server));
  }),
);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().positive().optional(),
  sslMode: z.enum(['disable', 'require', 'verify_full']).optional(),
  password: z.string().min(1).optional(),
});

serversRouter.patch(
  '/:id',
  requirePermission('server:update'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = parseBody(updateSchema, req.body);
    const existing = await prisma.dbServer.findFirst({ where: { id: req.params.id, tenantId: req.auth!.tenantId } });
    if (!existing) throw NotFound('Server not found');
    const { password, ...rest } = input;
    const server = await prisma.dbServer.update({ where: { id: existing.id }, data: rest });
    if (password) await updateServerCredentialPassword(server.id, password);
    await audit({ tenantId: req.auth!.tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'server.updated', target: `server:${server.id}` });
    res.json(publicServer(server));
  }),
);

serversRouter.delete(
  '/:id',
  requirePermission('server:delete'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.dbServer.findFirst({ where: { id: req.params.id, tenantId: req.auth!.tenantId } });
    if (!existing) throw NotFound('Server not found');
    await prisma.dbServer.delete({ where: { id: existing.id } });
    await audit({ tenantId: req.auth!.tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'server.deleted', target: `server:${existing.id}` });
    res.status(204).send();
  }),
);

serversRouter.post(
  '/:id/test',
  requirePermission('server:read'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const adapter = await getAdapter(req.params.id, req.auth!.tenantId);
    try {
      await adapter.testConnection();
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ ok: false, error: (err as Error).message });
    } finally {
      await adapter.close();
    }
  }),
);

serversRouter.get(
  '/:id/databases',
  requirePermission('server:read'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const adapter = await getAdapter(req.params.id, req.auth!.tenantId);
    try {
      const databases = await adapter.listDatabases();
      res.json({ data: databases });
    } finally {
      await adapter.close();
    }
  }),
);
