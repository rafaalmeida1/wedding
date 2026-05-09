'use server';

import { revalidatePath } from 'next/cache';
import { updateProfileSchema } from '@repo/shared/auth';
import type { AuthUser } from '@repo/shared/auth';
import { apiServer, ApiError } from '@/lib/api';

export interface SettingsState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function updateProfileAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const parsed = updateProfileSchema.safeParse({
    name: formData.get('name') || undefined,
    username: formData.get('username') || undefined,
    avatarUrl: formData.get('avatarUrl') || null,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    await apiServer<{ user: AuthUser }>('/api/auth/profile', {
      method: 'PATCH',
      json: parsed.data,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: 'erro inesperado' };
  }
  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard');
  return { success: 'Perfil atualizado.' };
}
