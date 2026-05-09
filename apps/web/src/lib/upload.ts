'use client';

import { apiClient, ApiError } from '@/lib/api-client';
import type { PresignedUrlResponse } from '@repo/shared';

export async function uploadProductImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('formato de imagem inválido (use JPG, PNG ou WebP)');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('imagem deve ter no máximo 8MB');
  }
  let presigned: PresignedUrlResponse;
  try {
    presigned = await apiClient.post<PresignedUrlResponse>(
      '/api/products/presigned-url',
      { contentType: file.type, size: file.size },
    );
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
  const res = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) {
    throw new Error(`falha ao fazer upload (${res.status})`);
  }
  return presigned.publicUrl;
}
