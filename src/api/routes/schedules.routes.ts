import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, parseBody } from '@/api/http';
import { authenticate, requirePermission } from '@/auth/middleware';
import type { AuthedRequest } from '@/auth/context';
import { registerSchedule, removeSchedule } from '@/scheduler/scheduleManager';
import { audit } from '@/audit/audit';
import { NotFound } from '@/lib/errors';

export const schedulesRouter = Router();
schedulesRouter.use(authenticate);

const createSchema = z.object({
  serverId: z.string().uuid(),
  database: z.string().min(1),
  cron: z.string().min(1),
  enabled: z.boolean().optional().default(true),
  retention: z.number().int().min(1).max(365).optional().default(7),
});

schedulesRouter.get(
  '/',
  requirePermission('schedule:manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = await prisma.schedule.findMany({ where: { tenantId: req.auth!.tenantId }, orderBy: { createdAt: 'desc' } });
    res.json({ data, total: data.length });
  }),
);

schedulesRouter.post(
  '/',
  requirePermission('schedule:manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = parseBody(createSchema, req.body);
    const tenantId = req.auth!.tenantId;
    const server = await prisma.dbServer.findFirst({ where: { id: input.serverId, tenantId } });
    if (!server) throw NotFound('Server not found');
    const schedule = await prisma.schedule.create({ data: { tenantId, type: 'backup', ...input } });
    if (schedule.enabled) await registerSchedule(schedule);
    await audit({ tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'schedule.created', target: `schedule:${schedule.id}`, meta: { cron: input.cron, database: input.database } });
    res.status(201).json(schedule);
  }),
);

const updateSchema = z.object({
  cron: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  retention: z.number().int().min(1).max(365).optional(),
});

schedulesRouter.patch(
  '/:id',
  requirePermission('schedule:manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = parseBody(updateSchema, req.body);
    const existing = await prisma.schedule.findFirst({ where: { id: req.params.id, tenantId: req.auth!.tenantId } });
    if (!existing) throw NotFound('Schedule not found');
    const schedule = await prisma.schedule.update({ where: { id: existing.id }, data: input });
    await removeSchedule(existing);
    if (schedule.enabled) await registerSchedule(schedule);
    await audit({ tenantId: req.auth!.tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'schedule.updated', target: `schedule:${schedule.id}` });
    res.json(schedule);
  }),
);

schedulesRouter.delete(
  '/:id',
  requirePermission('schedule:manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.schedule.findFirst({ where: { id: req.params.id, tenantId: req.auth!.tenantId } });
    if (!existing) throw NotFound('Schedule not found');
    await removeSchedule(existing);
    await prisma.schedule.delete({ where: { id: existing.id } });
    await audit({ tenantId: req.auth!.tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'schedule.deleted', target: `schedule:${existing.id}` });
    res.status(204).send();
  }),
);
