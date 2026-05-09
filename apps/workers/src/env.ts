import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Monorepo: variáveis vêm apenas do `.env` na raiz.
loadEnv({ path: resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  KAFKA_BROKERS: z.string().min(1).default('localhost:19092'),
  KAFKA_USERNAME: z.string().optional(),
  KAFKA_PASSWORD: z.string().optional(),
  KAFKA_SSL: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),
  KAFKA_CLIENT_ID: z.string().default('wedding-workers'),
  KAFKA_GROUP_ID: z.string().default('wedding-workers'),

  WORKERS_CONCURRENCY: z.coerce.number().int().positive().default(2),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().default('noreply@example.com'),
  SMTP_FROM_NAME: z.string().default('Lista de Presentes'),

  APP_URL: z.string().url().default('http://localhost:3000'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[env] invalid configuration', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
