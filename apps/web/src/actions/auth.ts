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
  try {
    const { data } = await apiServer<{ user: AuthUser }>('/api/auth/me');
    return data.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}
