import { Response, NextFunction } from 'express';
import { verifyAccessToken } from './jwt';
import { getUserPermissions } from './rbac';
import type { PermissionKey } from './permissions';
import type { AuthedRequest } from './context';
import { Unauthorized, Forbidden } from '@/lib/errors';

/** Authenticate via Bearer JWT and attach the resolved auth context (incl. permissions). */
export async function authenticate(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw Unauthorized('Missing bearer token');
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    const permissions = await getUserPermissions(payload.sub);
    req.auth = {
      userId: payload.sub,
      tenantId: payload.tid,
      email: payload.email,
      permissions,
    };
    next();
  } catch (err) {
    if ((err as { name?: string }).name === 'TokenExpiredError') return next(Unauthorized('Token expired'));
    if ((err as { name?: string }).name === 'JsonWebTokenError') return next(Unauthorized('Invalid token'));
    next(err);
  }
}

/** Guard a route by one or more required permissions (all must be present). */
export function requirePermission(...required: PermissionKey[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    if (!req.auth) return next(Unauthorized());
    for (const perm of required) {
      if (!req.auth.permissions.has(perm)) return next(Forbidden(`Missing permission: ${perm}`));
    }
    next();
  };
}
