// Server-only HTTP client. Encaminha cookies do browser para o Hono e retorna o
// `Set-Cookie` quando relevante. Use em Server Components ou Server Actions.

import 'server-only';
import { cookies } from 'next/headers';

import { ApiError, extractMessage, safeJson } from '@/lib/api-error';

export { ApiError } from '@/lib/api-error';

const INTERNAL_API_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

interface RequestOptions extends RequestInit {
  json?: unknown;
  /** quando true (default) força no-store em server requests. */
  noStore?: boolean;
  /** Sobrescreve o header Cookie inteiro (ex.: mesmo request após /auth/refresh). */
  cookieHeader?: string;
}

export async function apiServer<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<{ data: T; setCookie: string[] }> {
  const cookieStore = cookies();

  const { json, noStore = true, cookieHeader: cookieHeaderOverride, headers, ...rest } = opts;
  const upstreamCookie =
    cookieHeaderOverride !== undefined
      ? cookieHeaderOverride
      : cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');

  const init: RequestInit = {
    ...rest,
    headers: {
      Accept: 'application/json',
      Cookie: upstreamCookie,
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: noStore ? 'no-store' : rest.cache,
  };

  const origin = INTERNAL_API_URL.replace(/\/$/, '');
  let res: Response;
  try {
    res = await fetch(`${origin}${path}`, init);
  } catch (err) {
    const msg =
      err instanceof Error
        ? `${err.message} (${origin}${path}). Verifique API_INTERNAL_URL / NEXT_PUBLIC_API_URL no servidor.`
        : 'Falha de rede ao falar com a API (URL ou TLS). Confira NEXT_PUBLIC_API_URL/API_INTERNAL_URL.';
    throw new ApiError(502, msg, err);
  }
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  const setCookie = res.headers.getSetCookie?.() ?? [];

  if (!res.ok) {
    throw new ApiError(res.status, extractMessage(data, res.statusText), data);
  }
  return { data: data as T, setCookie };
}
