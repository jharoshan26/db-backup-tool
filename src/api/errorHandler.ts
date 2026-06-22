import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // Prisma unique-constraint and not-found mapping
  const code = (err as { code?: string }).code;
  if (code === 'P2002') {
    res.status(409).json({ error: { code: 'conflict', message: 'Resource already exists' } });
    return;
  }
  if (code === 'P2025') {
    res.status(404).json({ error: { code: 'not_found', message: 'Resource not found' } });
    return;
  }
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'internal', message: 'Internal server error' } });
}
