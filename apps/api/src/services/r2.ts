import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env.js';

let cachedClient: S3Client | null = null;
let warnedInvalidR2Public = false;

function endpoint(): string {
  if (!env.R2_ACCOUNT_ID) {
    throw new Error('R2_ACCOUNT_ID not configured');
  }
  return `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

function client(): S3Client {
  if (!cachedClient) {
    if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
      throw new Error('R2 credentials not configured');
    }
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: endpoint(),
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return cachedClient;
}

/** products/<uuid do usuário>/<uuid>.ext */
const PRODUCTS_KEY_REGEX = /^products\/[\da-f-]{36}\/[\da-f-]+\.(jpe?g|png|webp)$/i;

export function isAllowedProductImageKey(key: string): boolean {
  return PRODUCTS_KEY_REGEX.test(key);
}

/**
 * Deduz o R2 Key a partir da URL gravada em `products.image_url`.
 *
 * - Proxy: /api/public/r2/products/…
 * - URL pública (*.r2.dev / domínio customizado): path = key (ou bucket/key)
 * - Path-style API: *account*.r2.cloudflarestorage.com/bucket/products/...
 */
export function inferR2ObjectKeyFromPublicUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    const bucket = env.R2_BUCKET_NAME;
    let path = u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
    if (!path) return null;
    path = decodeURIComponent(path);

    const proxyMarker = 'api/public/r2/';
    if (path.startsWith(proxyMarker)) {
      return path.slice(proxyMarker.length) || null;
    }

    const host = u.hostname.toLowerCase();
    if (host.endsWith('.r2.cloudflarestorage.com')) {
      if (path.startsWith(`${bucket}/`)) return path.slice(bucket.length + 1);
      const firstHostLabel = u.hostname.split('.')[0]?.toLowerCase();
      if (firstHostLabel === bucket.toLowerCase()) return path;
      return null;
    }

    if (path.startsWith(`${bucket}/`)) return path.slice(bucket.length + 1);
    return path;
  } catch {
    return null;
  }
}

/** URL pública real (pub-*.r2.dev ou custom domain). `*.cloudflarestorage.com` nunca é GET público — ignoramos. */
function effectiveDirectPublicBase(): string | undefined {
  const raw = (env.R2_PUBLIC_URL ?? '').trim().replace(/\/$/, '');
  if (!raw) return undefined;
  if (/\br2\.cloudflarestorage\.com\b/i.test(raw)) {
    if (!warnedInvalidR2Public) {
      warnedInvalidR2Public = true;
      console.warn(
        '[r2] R2_PUBLIC_URL aponta para *.r2.cloudflarestorage.com (endpoint S3, sem leitura pública). ' +
          'Usando proxy GET /api/public/r2/… com API_PUBLIC_ORIGIN (ou localhost em dev).',
      );
    }
    return undefined;
  }
  return raw;
}

/** Base da API acessível pelo browser (proxy de imagens). */
function resolvedApiPublicOrigin(): string {
  const o = (env.API_PUBLIC_ORIGIN ?? '').trim().replace(/\/$/, '');
  if (o) return o;
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Produção: defina API_PUBLIC_ORIGIN=https://api-casar.bitrafa.com.br (mesma URL pública da API que o navegador usa). ' +
        'Ou defina R2_PUBLIC_URL=https://pub-….r2.dev (ou um custom domain público ao bucket no Cloudflare).',
    );
  }
  return `http://localhost:${env.API_PORT}`;
}

/** Sem barra final. */
function resolveProductImageBaseForPresign(): string {
  const direct = effectiveDirectPublicBase();
  if (direct) return direct;
  const apiOrigin = resolvedApiPublicOrigin();
  return `${apiOrigin}/api/public/r2`;
}

interface PresignArgs {
  key: string;
  contentType: string;
  contentLength: number;
}

export async function presignR2Upload({
  key,
  contentType,
  contentLength,
}: PresignArgs): Promise<{ uploadUrl: string; publicUrl: string; expiresIn: number }> {
  const expiresIn = 60 * 5;
  const url = await getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    }),
    { expiresIn },
  );

  const base = resolveProductImageBaseForPresign();
  const publicUrl = `${base}/${key}`;
  return { uploadUrl: url, publicUrl, expiresIn };
}

export async function getProductImageObject(
  key: string,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (!isAllowedProductImageKey(key)) {
    throw Object.assign(new Error('bad key'), { code: 'R2_KEY_FORBIDDEN' });
  }
  const out = await client().send(
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
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_ACCOUNT_ID) return;
  if (!key) return;
  await client().send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    }),
  );
}

/** Apaga arquivo no bucket se URL for gerida por nós; ignora erro (objeto já pode ter sumido). */
export async function tryDeleteProductImage(imageUrl: string | null | undefined): Promise<void> {
  const key = inferR2ObjectKeyFromPublicUrl(imageUrl ?? '');
  if (!key || !isAllowedProductImageKey(key)) return;
  try {
    await deleteR2ObjectByKey(key);
  } catch (err) {
    console.warn('[r2] delete object failed:', (err as Error).message ?? err);
  }
}
