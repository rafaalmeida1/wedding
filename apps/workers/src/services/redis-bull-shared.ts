import { Redis } from 'ioredis';
import { env } from '../env.js';

/** Uma conexão ioredis para BullMQ; workers usam `duplicate()`. */
let shared: Redis | null = null;

export function getSharedBullRedis(): Redis {
  if (!shared) {
    shared = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return shared;
}

export async function quitSharedBullRedis(): Promise<void> {
  if (shared) {
    await shared.quit().catch(() => null);
    shared = null;
  }
}
