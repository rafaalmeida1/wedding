import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Monorepo: variáveis vêm apenas do `.env` na raiz (`/nfc/.env`).
loadEnv({ path: resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(8080),
  APP_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),

  // Mercado Pago - Checkout Transparente (cartão + PIX + boleto + débito virtual Caixa)
  // Em produção use o token APP_USR-...; para tests usa-se TEST-...
  MP_ACCESS_TOKEN: z.string().default('TEST-replace-me'),
  // Secret configurada nas Notificações de Webhook do dashboard MP. Usada para
  // validar a assinatura `x-signature` do webhook. Opcional em dev.
  MP_WEBHOOK_SECRET: z.string().optional(),
  // URL pública usada como `notification_url` no payment.create (HTTPS; em dev ngrok/cloudflared).
  // `.env` vazio ou ausente é válido — o pagamento cria igual; só webhooks ficam só por polling/console MP.
  MP_NOTIFICATION_URL: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().url().optional(),
  ),
  // Nome/loja exibido na fatura do cartão (statement_descriptor). Máximo 22 chars.
  MP_STATEMENT_DESCRIPTOR: z.string().max(22).default('LISTA PRESENTES'),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('wedding-gifts'),
  // Leitura direta (bucket público / custom domain). Vazio = usar proxy abaixo.
  R2_PUBLIC_URL: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().url().optional(),
  ),
  // Base HTTP onde a API é acessível (ex.: mesmo valor que NEXT_PUBLIC_API_URL). Com R2_PUBLIC_URL
  // vazio, presigned devolve {API_PUBLIC_ORIGIN}/api/public/r2/{key} (bucket pode ficar privado).
  API_PUBLIC_ORIGIN: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().url().optional(),
  ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[env] Invalid configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
