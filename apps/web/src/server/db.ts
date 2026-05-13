import { createDb } from '@repo/db';
import { getEnv } from './env';

let instance: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!instance) {
    instance = createDb(getEnv().DATABASE_URL);
  }
  return instance;
}
