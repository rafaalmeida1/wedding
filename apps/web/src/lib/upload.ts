'use client';

import type { PresignedUrlResponse } from '@repo/shared';
import { presignedProductImageUploadAction } from '@/actions/uploads';

export async function uploadProductImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('formato de imagem inválido (use JPG, PNG ou WebP)');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('imagem deve ter no máximo 8MB');
  }
  let presigned: PresignedUrlResponse;
  try {
    presigned = await presignedProductImageUploadAction({
      contentType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
      size: file.size,
    });
  } catch (err) {
    if (err instanceof Error) throw err;
    throw new Error(String(err));
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
