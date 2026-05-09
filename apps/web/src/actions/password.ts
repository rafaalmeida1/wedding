'use server';

import { redirect } from 'next/navigation';
import { forgotPasswordSchema, resetPasswordSchema } from '@repo/shared/auth';
import { apiServer, ApiError } from '@/lib/api';

export interface PasswordState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function forgotPasswordAction(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    await apiServer<{ ok: true }>('/api/auth/forgot-password', {
      method: 'POST',
      json: parsed.data,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: 'erro inesperado' };
  }
  return { success: 'Se o e-mail existir, enviaremos um link em até 1 minuto.' };
}

export async function resetPasswordAction(
  token: string,
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    token,
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    await apiServer<{ ok: true }>('/api/auth/reset-password', {
      method: 'POST',
      json: parsed.data,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: 'erro inesperado' };
  }
  redirect('/login?reset=ok');
}
