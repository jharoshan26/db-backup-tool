import jwt from 'jsonwebtoken';
import { config } from '@/config';

export interface AccessTokenPayload {
  sub: string; // user id
  tid: string; // tenant id
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;
  tid: string;
  /** token version / family id for rotation + revocation */
  v: number;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  const opts: jwt.SignOptions = { expiresIn: config.jwt.accessTtl as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, config.jwt.accessSecret, opts);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  const opts: jwt.SignOptions = { expiresIn: config.jwt.refreshTtl as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, config.jwt.refreshSecret, opts);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
}
