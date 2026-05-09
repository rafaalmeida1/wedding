import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { ACCESS_COOKIE } from '../services/cookies.js';
import { verifyAccessToken, type AccessTokenPayload } from '../services/jwt.js';
import { redis, RedisKeys, ensureRedis } from '../services/redis.js';

export interface AuthContext {
  Variables: {
    user: AccessTokenPayload;
  };
}

export const requireAuth: MiddlewareHandler<AuthContext> = async (c, next) => {
  const token = getCookie(c, ACCESS_COOKIE);
  if (!token) {
    throw new HTTPException(401, { message: 'unauthenticated' });
  }
  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new HTTPException(401, { message: 'invalid token' });
  }

  await ensureRedis().catch(() => null);
  const blacklisted = await redis.get(RedisKeys.tokenBlacklist(payload.jti)).catch(() => null);
  if (blacklisted) {
    throw new HTTPException(401, { message: 'token revoked' });
  }

  c.set('user', payload);
  await next();
};

export function getAuthUser(c: Context<AuthContext>) {
  return c.get('user');
}
