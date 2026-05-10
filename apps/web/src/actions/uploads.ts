'use server';

import crypto from 'node:crypto';
import type { ProductImageUploadResponse } from '@repo/shared/products';
import { getCurrentUser } from '@/actions/auth';
import { productImagePublicUrl, putProductImage } from '@/lib/r2-product-image';

export type ProductImageUploadResult =
  | { ok: true; payload: ProductImageUploadResponse }
  | { ok: false; message: string };

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Next pode enviar o arquivo como `image` ou (Flight) tipo `1_image`. */
function getImageFromFormData(formData: FormData): File | null {
  const direct = formData.get('image');
  if (direct instanceof File && direct.size > 0) return direct;
  for (const [, val] of formData.entries()) {
    if (val instanceof File && val.size > 0) return val;
  }
  return null;
}

/**
 * Upload vai direto ao R2 a partir do Next (credenciais no ambiente da Vercel).
 * Evita 401 pelo Hono quando cookies de sessão não são repassados servidor→API.
 */
export async function uploadProductImageAction(formData: FormData): Promise<ProductImageUploadResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: 'Faça login novamente para enviar imagens.' };
  }

  const file = getImageFromFormData(formData);
  if (!file) {
    return { ok: false, message: 'envie um arquivo de imagem' };
  }
  const contentType = file.type ?? '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    return { ok: false, message: 'formato de imagem inválido (use JPG, PNG ou WebP)' };
  }
  const ext = MIME_TO_EXT[contentType];
  if (!ext) {
    return { ok: false, message: 'tipo MIME não aceito' };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, message: 'imagem deve ter no máximo 8MB' };
  }

  const id = crypto.randomUUID();
  const key = `products/${user.id}/${id}.${ext}`;

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    await putProductImage({ key, body: buf, contentType });
    const publicUrl = productImagePublicUrl(key);
    return { ok: true, payload: { publicUrl, key } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[uploadProductImageAction]', msg);
    return { ok: false, message: msg || 'falha ao enviar para o R2' };
  }
}
