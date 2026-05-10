'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { loginSchema, registerSchema } from '@repo/shared/auth';
import type { AuthUser } from '@repo/shared/auth';
import { apiServer, ApiError } from '@/lib/api';

export interface AuthState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

/** Alinhados a `ACCESS_COOKIE` / `REFRESH_COOKIE` na API. */
const WG_ACCESS = 'wg_access';
const WG_REFRESH = 'wg_refresh';

function mergedCookieHeader(
  snap: ReadonlyArray<{ name: string; value: string }>,
  updates: Partial<Record<string, string>>,
): string {
  const map: Record<string, string> = Object.fromEntries(snap.map((c) => [c.name, c.value]));
  for (const [k, v] of Object.entries(updates)) {
    if (typeof v === 'string' && v !== '') map[k] = v;
  }
  return Object.entries(map)
    .map(([n, v]) => `${n}=${v}`)
    .join('; ');
}

function authTokensFromSetCookieLines(lines: string[]): Partial<Record<string, string>> {
  const picked: Partial<Record<string, string>> = {};
  const want = new Set([WG_ACCESS, WG_REFRESH]);
  for (const line of lines) {
    const [first] = line.split(';');
    if (!first) continue;
    const eq = first.indexOf('=');
    if (eq === -1) continue;
    const name = first.slice(0, eq).trim();
    if (!want.has(name)) continue;
    picked[name] = first.slice(eq + 1).trim();
  }
  return picked;
}

function applySetCookie(setCookie: string[]) {
  const store = cookies();
  for (const raw of setCookie) {
    const [head, ...attrs] = raw.split(';');
    if (!head) continue;
    const eq = head.indexOf('=');
    if (eq === -1) continue;
    const name = head.slice(0, eq).trim();
    const value = head.slice(eq + 1).trim();
    const parsed: Record<string, string | boolean> = {};
    for (const a of attrs) {
      const [k, v] = a.split('=');
      if (!k) continue;
      const key = k.trim().toLowerCase();
      parsed[key] = v === undefined ? true : v.trim();
    }
    store.set({
      name,
      value,
      httpOnly: parsed.httponly === true,
      secure: parsed.secure === true,
      sameSite:
        parsed.samesite === 'Strict' || parsed.samesite === 'strict'
          ? 'strict'
          : parsed.samesite === 'Lax' || parsed.samesite === 'lax'
            ? 'lax'
            : parsed.samesite === 'None' || parsed.samesite === 'none'
              ? 'none'
              : 'lax',
      path: typeof parsed.path === 'string' ? parsed.path : '/',
      domain: typeof parsed.domain === 'string' ? parsed.domain : undefined,
      maxAge: typeof parsed['max-age'] === 'string' ? Number(parsed['max-age']) : undefined,
      expires:
        typeof parsed.expires === 'string' ? new Date(parsed.expires) : undefined,
    });
  }
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const { setCookie } = await apiServer<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      json: parsed.data,
    });
    applySetCookie(setCookie);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: 'erro inesperado' };
  }
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function registerAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    name: formData.get('name'),
    username: formData.get('username'),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const { setCookie } = await apiServer<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      json: parsed.data,
    });
    applySetCookie(setCookie);
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: 'erro inesperado' };
  }
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function logoutAction() {
  try {
    const { setCookie } = await apiServer<{ ok: true }>('/api/auth/logout', {
      method: 'POST',
    });
    applySetCookie(setCookie);
  } catch {
    // ignore: estamos saindo de qualquer forma
  }
  redirect('/login');
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const snap = [...cookies().getAll()];
  const cookieHeader = mergedCookieHeader(snap, {});
  try {
    const { data } = await apiServer<{ user: AuthUser }>('/api/auth/me', { cookieHeader });
    return data.user;
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    if (err.status !== 401) throw err;
  }

  try {
    const refresh = await apiServer<{ user: AuthUser }>('/api/auth/refresh', {
      method: 'POST',
      cookieHeader,
    });
    applySetCookie(refresh.setCookie);
    const updated = authTokensFromSetCookieLines(refresh.setCookie);
    const retryHeader =
      Object.keys(updated).length > 0 ? mergedCookieHeader(snap, updated) : cookieHeader;
    try {
      const { data } = await apiServer<{ user: AuthUser }>('/api/auth/me', {
        cookieHeader: retryHeader,
      });
      return data.user;
    } catch (e2) {
      if (e2 instanceof ApiError && e2.status === 401) return null;
      throw e2;
    }
  } catch (e1) {
    if (e1 instanceof ApiError && e1.status === 401) return null;
    throw e1;
  }
}
