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
}

export async function apiServer<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<{ data: T; setCookie: string[] }> {
  const cookieStore = cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const { json, noStore = true, headers, ...rest } = opts;
  const init: RequestInit = {
    ...rest,
    headers: {
      Accept: 'application/json',
      Cookie: cookieHeader,
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: noStore ? 'no-store' : rest.cache,
  };

  const res = await fetch(`${INTERNAL_API_URL}${path}`, init);
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  const setCookie = res.headers.getSetCookie?.() ?? [];

  if (!res.ok) {
    throw new ApiError(res.status, extractMessage(data, res.statusText), data);
  }
  return { data: data as T, setCookie };
}
