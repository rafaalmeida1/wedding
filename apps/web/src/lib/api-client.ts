// Browser-safe HTTP client — mesma origem (`/api/...`).

import { ApiError, extractMessage, safeJson } from '@/lib/api-error';

export { ApiError } from '@/lib/api-error';

interface RequestOptions extends RequestInit {
  json?: unknown;
  noStore?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { json, noStore = true, headers, ...rest } = opts;
  const init: RequestInit = {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: noStore ? 'no-store' : rest.cache,
    credentials: 'include',
  };

  const res = await fetch(path.startsWith('/') ? path : `/${path}`, init);
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, extractMessage(data, res.statusText), data);
  }
  return data as T;
}

export const apiClient = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, json?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', json }),
  patch: <T>(path: string, json?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', json }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};
