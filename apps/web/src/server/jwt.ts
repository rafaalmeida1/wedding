import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import { getEnv } from './env';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  username: string;
  jti: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  family: string;
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'jti'>) {
  const env = getEnv();
  const jti = crypto.randomUUID();
  const options: SignOptions = { expiresIn: env.JWT_ACCESS_TTL_SECONDS, jwtid: jti };
  const token = jwt.sign(payload, env.JWT_SECRET, options);
  return { token, jti, expiresIn: env.JWT_ACCESS_TTL_SECONDS };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, getEnv().JWT_SECRET) as AccessTokenPayload;
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'jti'>) {
  const env = getEnv();
  const jti = crypto.randomUUID();
  const options: SignOptions = { expiresIn: env.JWT_REFRESH_TTL_SECONDS, jwtid: jti };
  const token = jwt.sign(payload, env.JWT_REFRESH_SECRET, options);
  return { token, jti, expiresIn: env.JWT_REFRESH_TTL_SECONDS };
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, getEnv().JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
