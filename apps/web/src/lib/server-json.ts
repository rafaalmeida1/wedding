import 'server-only';
import { headers } from 'next/headers';
import { ApiError, extractMessage, safeJson } from './api-error';

export { ApiError } from './api-error';

/** Origem do próprio site (útil para Server Actions chamarem Route Handlers no mesmo deploy). */
export function serverOrigin(): string {
  const h = headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (process.env.VERCEL ? 'https' : 'http');
  return `${proto}://${host}`;
}

/**
 * `fetch` ao mesmo host com cookies do pedido atual.
 * Resposta: corpo JSON tipado (sem wrapper `{ data }`).
 */
export async function serverRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookie = headers().get('cookie') ?? '';
  const h = new Headers(init.headers);
  h.set('Accept', 'application/json');
  if (!h.has('Cookie')) {
    h.set('Cookie', cookie);
  }

  let res: Response;
  try {
    res = await fetch(`${serverOrigin()}${path}`, {
      ...init,
      headers: h,
      cache: 'no-store',
    });
  } catch (err) {
    const msg =
      err instanceof Error
        ? `${err.message} (${serverOrigin()}${path})`
        : 'Falha de rede ao chamar API interna';
    throw new ApiError(502, msg, err);
  }

  const text = await res.text();
  const parsed = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, extractMessage(parsed, res.statusText), parsed);
  }
  return parsed as T;
}

export async function serverRequestJson<T>(
  path: string,
  method: string,
  json?: unknown,
): Promise<T> {
  return serverRequest<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
}
