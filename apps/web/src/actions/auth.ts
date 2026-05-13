'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq, users } from '@repo/db';
import { loginSchema, registerSchema, type AuthUser } from '@repo/shared';
import { toAuthUser } from '@/server/auth-service';
import {
  mutateLogin,
  mutateLogout,
  mutateRefresh,
  mutateRegister,
} from '@/server/auth-mutations';
import { getDb } from '@/server/db';
import { getSessionUser } from '@/server/session';

export interface AuthState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

function actionCtx() {
  const h = headers();
  return {
    ip:
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      h.get('x-real-ip') ??
      '0.0.0.0',
    ua: h.get('user-agent') ?? '',
  };
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const result = await mutateLogin(parsed.data, actionCtx());
  if (!result.ok) {
    return { error: result.message };
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
  const result = await mutateRegister(parsed.data, actionCtx());
  if (!result.ok) {
    return { error: result.message };
  }
  revalidatePath('/dashboard');
  redirect('/dashboard');
}

export async function logoutAction() {
  try {
    await mutateLogout();
  } catch {
    /* ignore */
  }
  redirect('/login');
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const auth = await getSessionUser();
  if (!auth) {
    const refreshed = await mutateRefresh(actionCtx());
    if (!refreshed.ok) {
      return null;
    }
    return refreshed.data.user;
  }
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, auth.sub)).limit(1);
  return user ? toAuthUser(user) : null;
}
