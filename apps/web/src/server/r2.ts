import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getEnv } from './env';

let cachedClient: S3Client | null = null;
let warnedInvalidR2Public = false;

function r2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function getClient(): S3Client {
  const env = getEnv();
  if (!cachedClient) {
    if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ACCOUNT_ID) {
      throw new Error('R2 credentials not configured');
    }
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: r2Endpoint(env.R2_ACCOUNT_ID),
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  }
  return cachedClient;
}

const PRODUCTS_KEY_REGEX = /^products\/[\da-f-]{36}\/[\da-f-]+\.(jpe?g|png|webp)$/i;

export function isAllowedProductImageKey(key: string): boolean {
  return PRODUCTS_KEY_REGEX.test(key);
}

export function inferR2ObjectKeyFromPublicUrl(raw: string): string | null {
  if (!raw) return null;
  const env = getEnv();
  try {
    const u = new URL(raw.trim());
    const bucket = env.R2_BUCKET_NAME;
    let pathPart = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
    if (!pathPart) return null;
    pathPart = decodeURIComponent(pathPart);

    const proxyMarker = 'api/public/r2/';
    if (pathPart.startsWith(proxyMarker)) {
      return pathPart.slice(proxyMarker.length) || null;
    }

    const host = u.hostname.toLowerCase();
    if (host.endsWith('.r2.cloudflarestorage.com')) {
      if (pathPart.startsWith(`${bucket}/`)) return pathPart.slice(bucket.length + 1);
      const firstHostLabel = u.hostname.split('.')[0]?.toLowerCase();
      if (firstHostLabel === bucket.toLowerCase()) return pathPart;
      return null;
    }

    if (pathPart.startsWith(`${bucket}/`)) return pathPart.slice(bucket.length + 1);
    return pathPart;
  } catch {
    return null;
  }
}

function effectiveDirectPublicBase(): string | undefined {
  const env = getEnv();
  const raw = (env.R2_PUBLIC_URL ?? '').trim().replace(/\/$/, '');
  if (!raw) return undefined;
  if (/\br2\.cloudflarestorage\.com\b/i.test(raw)) {
    if (!warnedInvalidR2Public) {
      warnedInvalidR2Public = true;
      console.warn(
        '[r2] R2_PUBLIC_URL aponta para endpoint S3; use *.r2.dev ou proxy /api/public/r2.',
      );
    }
    return undefined;
  }
  return raw;
}

function appOriginOrThrow(): string {
  const env = getEnv();
  const o = env.APP_URL.trim().replace(/\/$/, '');
  if (o) return o;
  throw new Error('APP_URL não configurado — necess para URLs de imagem via proxy.');
}

export function resolveProductImagePublicBaseServer(): string {
  const direct = effectiveDirectPublicBase();
  if (direct) return direct;
  const origin = appOriginOrThrow();
  return `${origin}/api/public/r2`;
}

export function productImagePublicUrlFromKey(key: string): string {
  const base = resolveProductImagePublicBaseServer();
  const segments = key.split('/').map(encodeURIComponent);
  return `${base}/${segments.join('/')}`;
}

export async function putProductImageDirect(args: {
  key: string;
  body: Uint8Array | Buffer;
  contentType: string;
}): Promise<void> {
  const env = getEnv();
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: args.key,
      Body: Buffer.isBuffer(args.body) ? args.body : Buffer.from(args.body),
      ContentType: args.contentType,
      ContentLength: args.body.length,
    }),
  );
}

export async function getProductImageObject(
  key: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  const env = getEnv();
  if (!isAllowedProductImageKey(key)) {
    throw Object.assign(new Error('bad key'), { code: 'R2_KEY_FORBIDDEN' });
  }
  const out = await getClient().send(
    new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }),
  );
  const body = out.Body;
  if (!body) {
    throw Object.assign(new Error('empty body'), { code: 'NotFound' });
  }
  const bytes = await body.transformToByteArray();
  const contentType = out.ContentType ?? 'application/octet-stream';
  return { bytes, contentType };
}

export async function deleteR2ObjectByKey(key: string): Promise<void> {
  const env = getEnv();
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ACCOUNT_ID) return;
  if (!key) return;
  await getClient().send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }),
  );
}

export async function tryDeleteProductImage(imageUrl: string | null | undefined): Promise<void> {
  const key = inferR2ObjectKeyFromPublicUrl(imageUrl ?? '');
  if (!key || !isAllowedProductImageKey(key)) return;
  try {
    await deleteR2ObjectByKey(key);
  } catch (err) {
    console.warn('[r2] delete object failed:', (err as Error).message ?? err);
  }
}
