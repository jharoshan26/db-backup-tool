import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, parseBody } from '@/api/http';
import { authenticate, requirePermission } from '@/auth/middleware';
import type { AuthedRequest } from '@/auth/context';
import { hashPassword } from '@/auth/password';
import { audit } from '@/audit/audit';
import { NotFound, BadRequest } from '@/lib/errors';

export const usersRouter = Router();
usersRouter.use(authenticate);

function publicUser(u: { id: string; email: string; name: string | null; status: string; createdAt: Date }, roles?: { id: string; name: string }[]) {
  return { id: u.id, email: u.email, name: u.name, status: u.status, createdAt: u.createdAt, roles: roles ?? [] };
}

usersRouter.get(
  '/',
  requirePermission('user:manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const users = await prisma.user.findMany({
      where: { tenantId: req.auth!.tenantId },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const data = users.map((u) => publicUser(u, u.roles.map((r) => ({ id: r.role.id, name: r.role.name }))));
    res.json({ data, total: data.length });
  }),
);

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string().min(8),
  roleId: z.string().uuid().optional(),
});

usersRouter.post(
  '/',
  requirePermission('user:manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = parseBody(createSchema, req.body);
    const tenantId = req.auth!.tenantId;
    if (input.roleId) {
      const role = await prisma.role.findFirst({ where: { id: input.roleId, tenantId } });
      if (!role) throw BadRequest('Invalid role');
    }
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        roles: input.roleId ? { create: { roleId: input.roleId } } : undefined,
      },
      include: { roles: { include: { role: true } } },
    });
    await audit({ tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'user.created', target: `user:${user.id}`, meta: { email: input.email } });
    res.status(201).json(publicUser(user, user.roles.map((r) => ({ id: r.role.id, name: r.role.name }))));
  }),
);

const updateSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['active', 'disabled']).optional(),
  password: z.string().min(8).optional(),
});

usersRouter.patch(
  '/:id',
  requirePermission('user:manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const input = parseBody(updateSchema, req.body);
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.auth!.tenantId } });
    if (!existing) throw NotFound('User not found');
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { name: input.name, status: input.status, ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}) },
    });
    await audit({ tenantId: req.auth!.tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'user.updated', target: `user:${user.id}` });
    res.json(publicUser(user));
  }),
);

usersRouter.delete(
  '/:id',
  requirePermission('user:manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    if (req.params.id === req.auth!.userId) throw BadRequest('You cannot delete yourself');
    const existing = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.auth!.tenantId } });
    if (!existing) throw NotFound('User not found');
    await prisma.user.delete({ where: { id: existing.id } });
    await audit({ tenantId: req.auth!.tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'user.deleted', target: `user:${existing.id}` });
    res.status(204).send();
  }),
);

const assignSchema = z.object({ roleId: z.string().uuid() });

usersRouter.post(
  '/:id/roles',
  requirePermission('user:manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { roleId } = parseBody(assignSchema, req.body);
    const tenantId = req.auth!.tenantId;
    const user = await prisma.user.findFirst({ where: { id: req.params.id, tenantId } });
    if (!user) throw NotFound('User not found');
    const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
    if (!role) throw BadRequest('Invalid role');
    await prisma.roleAssignment.upsert({ where: { userId_roleId: { userId: user.id, roleId } }, create: { userId: user.id, roleId }, update: {} });
    await audit({ tenantId, actorId: req.auth!.userId, actorEmail: req.auth!.email, action: 'user.role_assigned', target: `user:${user.id}`, meta: { roleId } });
    res.json({ ok: true });
  }),
);

// Roles listing (same permission gate).
export const rolesRouter = Router();
rolesRouter.use(authenticate);
rolesRouter.get(
  '/',
  requirePermission('user:manage'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const roles = await prisma.role.findMany({ where: { tenantId: req.auth!.tenantId }, include: { permissions: true } });
    res.json({ data: roles.map((r) => ({ id: r.id, name: r.name, isSystem: r.isSystem, permissions: r.permissions.map((p) => p.permissionKey) })) });
  }),
);
