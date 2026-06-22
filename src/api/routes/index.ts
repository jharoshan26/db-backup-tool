import { Router } from 'express';
import { authRouter } from './auth.routes';
import { serversRouter } from './servers.routes';
import { backupsRouter } from './backups.routes';
import { transferRouter } from './transfer.routes';
import { jobsRouter } from './jobs.routes';
import { schedulesRouter } from './schedules.routes';
import { auditRouter } from './audit.routes';
import { usersRouter, rolesRouter } from './users.routes';
import { notificationsRouter } from './notifications.routes';
import { authenticate } from '@/auth/middleware';
import type { AuthedRequest } from '@/auth/context';
import { prisma } from '@/lib/prisma';
import { asyncHandler } from '@/api/http';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);

// Top-level /me convenience endpoint (mirrors /auth/me).
apiRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    res.json({ id: user!.id, email: user!.email, name: user!.name, tenantId: user!.tenantId, permissions: [...req.auth!.permissions] });
  }),
);

apiRouter.use('/servers', serversRouter);
// backups + transfer routers also register /servers/:id/<action> sub-routes at root level.
apiRouter.use('/', backupsRouter);
apiRouter.use('/', transferRouter);
apiRouter.use('/jobs', jobsRouter);
apiRouter.use('/schedules', schedulesRouter);
apiRouter.use('/audit', auditRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/roles', rolesRouter);
apiRouter.use('/notifications', notificationsRouter);
