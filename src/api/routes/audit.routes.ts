import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, parseQuery } from '@/api/http';
import { authenticate, requirePermission } from '@/auth/middleware';
import type { AuthedRequest } from '@/auth/context';
import { verifyAuditChain } from '@/audit/audit';

export const auditRouter = Router();
auditRouter.use(authenticate);

const querySchema = z.object({
  q: z.string().optional(),
  action: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

auditRouter.get(
  '/',
  requirePermission('audit:read'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { q, action, limit } = parseQuery(querySchema, req.query);
    const tenantId = req.auth!.tenantId;
    const where = {
      tenantId,
      ...(action ? { action } : {}),
      ...(q ? { OR: [{ action: { contains: q, mode: 'insensitive' as const } }, { target: { contains: q, mode: 'insensitive' as const } }, { actorEmail: { contains: q, mode: 'insensitive' as const } }] } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit }),
      prisma.auditLog.count({ where }),
    ]);
    res.json({ data, total });
  }),
);

auditRouter.get(
  '/verify',
  requirePermission('audit:read'),
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await verifyAuditChain(req.auth!.tenantId);
    res.json(result);
  }),
);
