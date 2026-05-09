import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Database = ReturnType<typeof createDb>;

export function createDb(databaseUrl: string, options?: { max?: number }) {
  const client = postgres(databaseUrl, {
    max: options?.max ?? 10,
    prepare: false,
  });
  return drizzle(client, { schema });
}
