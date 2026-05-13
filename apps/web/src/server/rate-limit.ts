import { NextResponse } from 'next/server';
import { ensureRedis, getRedis, RedisKeys } from './redis';

export async function rateLimitOrNull(
  req: Request,
  pathname: string,
  max: number,
  windowSeconds: number,
): Promise<NextResponse | null> {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '0.0.0.0';
  const key = RedisKeys.rateLimit(`${ip}:${pathname}`);
  try {
    await ensureRedis();
    const redis = getRedis();
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    if (count > max) {
      return NextResponse.json({ error: 'too many requests' }, { status: 429 });
    }
  } catch {
    console.warn('[rateLimit] redis unavailable, skipping');
  }
  return null;
}
