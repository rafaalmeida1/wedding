import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { getProductImageObject, isAllowedProductImageKey } from '@/server/r2';
import { rateLimitOrNull } from '@/server/rate-limit';

export const runtime = 'nodejs';

type Ctx = { params: { key: string[] } };

export async function GET(req: Request, { params }: Ctx) {
  const limited = await rateLimitOrNull(req, '/api/public/r2', 400, 60);
  if (limited) return limited;

  const segments = params.key ?? [];
  const key = segments.map((s) => decodeURIComponent(s)).join('/');
  if (!key || !isAllowedProductImageKey(key)) {
    return new NextResponse('not found', { status: 404 });
  }

  try {
    const { bytes, contentType } = await getProductImageObject(key);
    const buf = Buffer.from(bytes);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
      },
    });
  } catch (err: unknown) {
    const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code === 'R2_KEY_FORBIDDEN') {
      return new NextResponse('not found', { status: 404 });
    }
    const name =
      typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
    if (name === 'NoSuchKey') {
      return new NextResponse('not found', { status: 404 });
    }
    console.warn('[r2-proxy]', err);
    return new NextResponse('not found', { status: 404 });
  }
}
