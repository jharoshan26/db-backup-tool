import type { Request } from 'express';

export interface AuthContext {
  userId: string;
  tenantId: string;
  email: string;
  permissions: Set<string>;
}

export interface AuthedRequest extends Request {
  auth?: AuthContext;
}

export function requireAuth(req: AuthedRequest): AuthContext {
  if (!req.auth) throw new Error('Auth context missing — route not protected by authenticate()');
  return req.auth;
}
