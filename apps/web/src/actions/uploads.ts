'use server';

import { presignedUrlSchema, type PresignedUrlResponse } from '@repo/shared/products';
import { apiServer, ApiError } from '@/lib/api';

export async function presignedProductImageUploadAction(input: unknown): Promise<PresignedUrlResponse> {
  const parsed = presignedUrlSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join(', ') || 'dados inválidos');
  }
  try {
    const { data } = await apiServer<PresignedUrlResponse>('/api/products/presigned-url', {
      method: 'POST',
      json: parsed.data,
    });
    return data;
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
}
