'use server';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import type { ProductImageUploadResponse } from '@repo/shared/products';
import { resolveProductImageMimeType } from '@repo/shared';
import { getCurrentUser } from '@/actions/auth';
import { resolveSessionUserIdFromCookie } from '@/lib/access-jwt';
import { productImagePublicUrl, putProductImage } from '@/lib/r2-product-image';

export type ProductImageUploadResult =
  | { ok: true; payload: ProductImageUploadResponse }
  | { ok: false; message: string };

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
 * Upload vai direto ao R2 no Next (`PutObject`).
 * Preferimos `sub` do JWT no cookie (`wg_access`) — não depende de `fetch` à API funcionar na Vercel.
 */
export async function uploadProductImageAction(formData: FormData): Promise<ProductImageUploadResult> {
  let userId = resolveSessionUserIdFromCookie();
  if (!userId) {
    const user = await getCurrentUser();
    if (user) userId = user.id;
  }
  if (!userId) {
    const jar = cookies().getAll().map((c) => c.name).join(', ');
    console.warn('[uploadProductImageAction] sessão não resolvida', {
      hasJwtSecretOnNext: !!(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16),
      cookieNames: jar || '(none)',
    });
    return { ok: false, message: 'Faça login novamente para enviar imagens.' };
  }

  const file = getImageFromFormData(formData);
  if (!file) {
    return { ok: false, message: 'envie um arquivo de imagem' };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, message: 'imagem deve ter no máximo 8MB' };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const resolved = resolveProductImageMimeType(file.type, buf);
  if (!resolved) {
    return { ok: false, message: 'formato de imagem inválido (use JPG, PNG ou WebP)' };
  }
  const { contentType, ext } = resolved;

  const id = crypto.randomUUID();
  const key = `products/${userId}/${id}.${ext}`;

  try {
    await putProductImage({ key, body: buf, contentType });
    const publicUrl = productImagePublicUrl(key);
    return { ok: true, payload: { publicUrl, key } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[uploadProductImageAction]', msg);
    return { ok: false, message: msg || 'falha ao enviar para o R2' };
  }
}
