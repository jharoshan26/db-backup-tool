import { Router } from 'express';
import { prisma } from '@/lib/prisma';
import { asyncHandler } from '@/api/http';
import { authenticate } from '@/auth/middleware';
import type { AuthedRequest } from '@/auth/context';
import { NotFound } from '@/lib/errors';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const data = await prisma.notification.findMany({ where: { userId: req.auth!.userId }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ data, total: data.length });
  }),
);

notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req: AuthedRequest, res) => {
    const existing = await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.auth!.userId } });
    if (!existing) throw NotFound('Notification not found');
    const updated = await prisma.notification.update({ where: { id: existing.id }, data: { readAt: new Date() } });
    res.json(updated);
  }),
);
