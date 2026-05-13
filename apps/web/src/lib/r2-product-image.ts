import 'server-only';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getPublicSiteOrigin } from '@/lib/public-site-origin';

/** Mesmo limite do schema de produtos. */
const MAX_BYTES = 8 * 1024 * 1024;

let warnedInvalidR2Public = false;

let cachedClient: S3Client | null = null;

function r2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function clientOrThrow(): S3Client {
  if (cachedClient) return cachedClient;
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Variáveis R2 ausentes no Next (ex.: na Vercel defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).',
    );
  }
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint(accountId),
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
  return cachedClient;
}

function bucketOrThrow(): string {
  const b = process.env.R2_BUCKET_NAME?.trim();
  if (!b) {
    throw new Error('Defina R2_BUCKET_NAME no ambiente do Next (ex.: wedding).');
  }
  return b;
}

function effectiveDirectPublicBase(): string | undefined {
  const raw = (process.env.R2_PUBLIC_URL ?? '').trim().replace(/\/$/, '');
  if (!raw) return undefined;
  if (/\br2\.cloudflarestorage\.com\b/i.test(raw)) {
    if (!warnedInvalidR2Public) {
      warnedInvalidR2Public = true;
      console.warn(
        '[web:r2] R2_PUBLIC_URL aponta para *.cloudflarestorage.com — use *.r2.dev ou deixe vazio para proxy no Next (`/api/public/r2/`).',
      );
    }
    return undefined;
  }
  return raw;
}

function siteOriginOrThrow(): string {
  return getPublicSiteOrigin();
}

/** Base pública para montar URL de imagem (R2 direto ou proxy no próprio Next). */
export function resolveProductImagePublicUrlBase(): string {
  const direct = effectiveDirectPublicBase();
  if (direct) return direct;
  const origin = siteOriginOrThrow();
  return `${origin}/api/public/r2`;
}

export function productImagePublicUrl(key: string): string {
  const base = resolveProductImagePublicUrlBase();
  const segments = key.split('/').map(encodeURIComponent);
  return `${base}/${segments.join('/')}`;
}

export async function putProductImage(args: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<void> {
  if (args.body.length > MAX_BYTES || args.body.length === 0) {
    throw new Error('imagem inválida (tamanho)');
  }
  await clientOrThrow().send(
    new PutObjectCommand({
      Bucket: bucketOrThrow(),
      Key: args.key,
      Body: args.body,
      ContentType: args.contentType,
      ContentLength: args.body.length,
    }),
  );
}
