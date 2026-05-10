'use server';

import type { ProductImageUploadResponse } from '@repo/shared/products';
import { apiServerMultipart } from '@/lib/api';
import { errorMessageFromUnknown } from '@/lib/api-error';

export type ProductImageUploadResult =
  | { ok: true; payload: ProductImageUploadResponse }
  | { ok: false; message: string };

/** Multipart server→API: credenciais R2 só na API; cookie de sessão segue no fetch do Next. */
export async function uploadProductImageAction(formData: FormData): Promise<ProductImageUploadResult> {
  const file = formData.get('image');
  if (!(file instanceof Blob) || file.size <= 0) {
    return { ok: false, message: 'envie um arquivo de imagem' };
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return { ok: false, message: 'formato de imagem inválido (use JPG, PNG ou WebP)' };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, message: 'imagem deve ter no máximo 8MB' };
  }

  const outbound = new FormData();
  outbound.append('image', file);

  try {
    const { data } = await apiServerMultipart<ProductImageUploadResponse>(
      '/api/products/upload-image',
      outbound,
    );
    return { ok: true, payload: data };
  } catch (err) {
    return { ok: false, message: errorMessageFromUnknown(err) };
  }
}
