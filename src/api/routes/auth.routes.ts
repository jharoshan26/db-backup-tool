import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { asyncHandler, parseBody } from '@/api/http';
import { verifyPassword } from '@/auth/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/auth/jwt';
import { getUserPermissions } from '@/auth/rbac';
import { registerTenant } from '@/modules/tenancy/bootstrap';
import { authenticate } from '@/auth/middleware';
import type { AuthedRequest } from '@/auth/context';
import { audit } from '@/audit/audit';
import { Unauthorized } from '@/lib/errors';
import { config } from '@/config';

export const authRouter = Router();

const REFRESH_COOKIE = 'refresh_token';
const refreshCookieOpts = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 3600 * 1000,
};

const registerSchema = z.object({
  tenantName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = parseBody(registerSchema, req.body);
    const { tenant, user } = await registerTenant(input);
    const accessToken = signAccessToken({ sub: user.id, tid: tenant.id, email: user.email });
    const refreshToken = signRefreshToken({ sub: user.id, tid: tenant.id, v: 1 });
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts);
    const permissions = [...(await getUserPermissions(user.id))];
    res.status(201).json({ accessToken, user: { id: user.id, email: user.email, name: user.name, tenantId: tenant.id, permissions } });
  }),
);

const loginSchema = z.object({ email: z.string().email(), password: z.string() });

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user || user.status === 'disabled') throw Unauthorized('Invalid credentials');
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      await audit({ tenantId: user.tenantId, actorId: user.id, actorEmail: email, action: 'auth.login_failed', ip: req.ip });
      throw Unauthorized('Invalid credentials');
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const accessToken = signAccessToken({ sub: user.id, tid: user.tenantId, email: user.email });
    const refreshToken = signRefreshToken({ sub: user.id, tid: user.tenantId, v: 1 });
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts);
    const permissions = [...(await getUserPermissions(user.id))];
    await audit({ tenantId: user.tenantId, actorId: user.id, actorEmail: email, action: 'auth.login', ip: req.ip });
    res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name, tenantId: user.tenantId, permissions } });
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw Unauthorized('Missing refresh token');
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw Unauthorized('Invalid refresh token');
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === 'disabled') throw Unauthorized('Invalid refresh token');
    const accessToken = signAccessToken({ sub: user.id, tid: user.tenantId, email: user.email });
    // rotate refresh token
    const refreshToken = signRefreshToken({ sub: user.id, tid: user.tenantId, v: payload.v });
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOpts);
    res.json({ accessToken });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    res.json({ ok: true });
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const auth = req.auth!;
    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    res.json({
      id: user!.id,
      email: user!.email,
      name: user!.name,
      tenantId: user!.tenantId,
      permissions: [...auth.permissions],
    });
  }),
);
