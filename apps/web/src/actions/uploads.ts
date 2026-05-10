'use server';

import { presignedUrlSchema, type PresignedUrlResponse } from '@repo/shared/products';
import { apiServer, ApiError } from '@/lib/api';

/** Next pode serializar um único argumento como array `[payload]` na action. */
function unwrapServerActionArg(input: unknown): unknown {
  let cur = input;
  while (Array.isArray(cur) && cur.length === 1) {
    cur = cur[0];
  }
  return cur;
}

export async function presignedProductImageUploadAction(input: unknown): Promise<PresignedUrlResponse> {
  const normalized = unwrapServerActionArg(input);
  const parsed = presignedUrlSchema.safeParse(normalized);
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
    if (err instanceof Error) throw err;
    throw new Error(String(err));
  }
}
