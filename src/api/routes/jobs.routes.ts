import { Router } from 'express';
import { prisma } from '@/lib/prisma';
import { asyncHandler } from '@/api/http';
import { authenticate, requirePermission } from '@/auth/middleware';
import type { AuthedRequest } from '@/auth/context';
import { verifyAccessToken } from '@/auth/jwt';
import { getUserPermissions } from '@/auth/rbac';
import { subscribeProgress } from '@/queue';
import { NotFound, Unauthorized } from '@/lib/errors';

export const jobsRouter = Router();

function publicJob(j: {
  id: string; type: string; status: string; progress: number; params: unknown; result: unknown; error: string | null; createdAt: Date; startedAt: Date | null; finishedAt: Date | null;
}) {
  return { id: j.id, type: j.type, status: j.status, progress: j.progress, params: j.params, result: j.result, error: j.error, createdAt: j.createdAt, startedAt: j.startedAt, finishedAt: j.finishedAt };
}

jobsRouter.get(
  '/',
  authenticate,
  requirePermission('job:read'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const tenantId = req.auth!.tenantId;
    const [data, total] = await Promise.all([
      prisma.job.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.job.count({ where: { tenantId } }),
    ]);
    res.json({ data: data.map(publicJob), total });
  }),
);

jobsRouter.get(
  '/:id',
  authenticate,
  requirePermission('job:read'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const job = await prisma.job.findFirst({ where: { id: req.params.id, tenantId: req.auth!.tenantId }, include: { events: { orderBy: { createdAt: 'asc' }, take: 200 } } });
    if (!job) throw NotFound('Job not found');
    res.json({ ...publicJob(job), events: job.events });
  }),
);

// SSE progress stream. EventSource cannot send Authorization headers, so we accept
// the access token via ?token= (short-lived JWT) in addition to the standard header.
jobsRouter.get(
  '/:id/stream',
  asyncHandler(async (req, res) => {
    const headerToken = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
    const token = headerToken ?? (req.query.access_token as string | undefined) ?? (req.query.token as string | undefined);
    if (!token) throw Unauthorized('Missing token');
    let tenantId: string;
    let userId: string;
    try {
      const payload = verifyAccessToken(token);
      tenantId = payload.tid;
      userId = payload.sub;
    } catch {
      throw Unauthorized('Invalid token');
    }
    const perms = await getUserPermissions(userId);
    if (!perms.has('job:read')) throw Unauthorized('Missing permission');

    const job = await prisma.job.findFirst({ where: { id: req.params.id, tenantId } });
    if (!job) throw NotFound('Job not found');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    send({ jobId: job.id, status: job.status, progress: job.progress });

    if (job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') {
      res.end();
      return;
    }

    const unsubscribe = subscribeProgress(job.id, (ev) => {
      send(ev);
      if (ev.status === 'done' || ev.status === 'failed' || ev.status === 'cancelled') {
        cleanup();
        res.end();
      }
    });
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
    function cleanup() {
      clearInterval(heartbeat);
      unsubscribe();
    }
    req.on('close', cleanup);
  }),
);
