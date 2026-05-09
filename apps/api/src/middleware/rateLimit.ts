import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ensureRedis, redis, RedisKeys } from '../services/redis.js';

interface RateLimitOptions {
  max: number;
  windowSeconds: number;
}

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      '0.0.0.0';
    const key = RedisKeys.rateLimit(`${ip}:${c.req.path}`);
    try {
      await ensureRedis();
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, opts.windowSeconds);
      }
      if (count > opts.max) {
        throw new HTTPException(429, { message: 'too many requests' });
      }
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      // Redis indisponível em dev: deixa passar para não quebrar o fluxo.
      console.warn('[rateLimit] redis unavailable, skipping');
    }
    await next();
  };
}
