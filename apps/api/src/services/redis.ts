import { Redis } from 'ioredis';
import { env } from '../env.js';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

let connected = false;
export async function ensureRedis() {
  if (connected) return redis;
  await redis.connect().catch((err: Error) => {
    console.error('[redis] connection failed; commands will reject', err.message);
  });
  connected = true;
  return redis;
}

export const RedisKeys = {
  productStock: (id: string) => `product:stock:${id}`,
  rateLimit: (ip: string) => `ratelimit:${ip}`,
  tokenBlacklist: (jti: string) => `token:blacklist:${jti}`,
} as const;
