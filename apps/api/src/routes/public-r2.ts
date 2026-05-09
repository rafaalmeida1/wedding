import { Buffer } from 'node:buffer';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getProductImageObject } from '../services/r2.js';

/** Montado em `/api/public`. Path completo da requisição: `/api/public/r2/{key}` */

const app = new Hono();

function extractKey(reqUrl: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(reqUrl).pathname;
  } catch {
    return null;
  }
  const prefix = '/api/public/r2/';
  if (!pathname.startsWith(prefix)) return null;
  const raw = pathname.slice(prefix.length);
  return raw ? decodeURIComponent(raw) : null;
}

app.get('/r2/*', async (c) => {
  const key = extractKey(c.req.url);
  if (!key) throw new HTTPException(404, { message: 'not found' });

  try {
    const { bytes, contentType } = await getProductImageObject(key);
    const buf = Buffer.from(bytes);
    return c.body(buf, 200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
    });
  } catch (err: unknown) {
    const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code === 'R2_KEY_FORBIDDEN') {
      throw new HTTPException(404, { message: 'not found' });
    }
    const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: unknown }).name) : '';
    if (name === 'NoSuchKey') {
      throw new HTTPException(404, { message: 'not found' });
    }
    console.warn('[r2-proxy]', err);
    throw new HTTPException(404, { message: 'not found' });
  }
});

export default app;
