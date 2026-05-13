import Redis from 'ioredis';
import { getEnv } from './env';

export const RedisKeys = {
  productStock: (id: string) => `product:stock:${id}`,
  rateLimit: (ipAndPath: string) => `ratelimit:${ipAndPath}`,
  tokenBlacklist: (jti: string) => `token:blacklist:${jti}`,
  paymentFulfilled: (paymentId: string) => `payment:fulfilled:${paymentId}`,
} as const;

let client: Redis | null = null;
let connected = false;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(getEnv().REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });
  }
  return client;
}

export async function ensureRedis(): Promise<Redis> {
  const redis = getRedis();
  if (!connected) {
    await redis.connect().catch((err: Error) => {
      console.error('[redis] connection failed', err.message);
    });
    connected = true;
  }
  return redis;
}
