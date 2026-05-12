import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import crypto from 'node:crypto';
import { resolveProductImageMimeType } from '@repo/shared';
import {
  putProductImageDirect,
  productImagePublicUrl,
} from '../services/r2.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';

const app = new Hono<AuthContext>();

const MAX_BYTES = 8 * 1024 * 1024;

app.post('/upload-image', requireAuth, async (c) => {
  const auth = c.get('user');
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new HTTPException(400, { message: 'corpo multipart inválido' });
  }
  const entry = form.get('image');
  if (!entry || typeof entry !== 'object') {
    throw new HTTPException(400, { message: 'campo "image" é obrigatório' });
  }
  const blob = entry as Blob & { readonly type?: string };
  const size = blob.size ?? 0;
  if (!(size > 0 && size <= MAX_BYTES)) {
    throw new HTTPException(400, { message: `imagem deve ter entre 1 e ${MAX_BYTES} bytes` });
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  const resolved = resolveProductImageMimeType(blob.type, buf);
  if (!resolved) {
    throw new HTTPException(400, {
      message: 'formato de imagem inválido (use JPG, PNG ou WebP)',
    });
  }
  const { contentType, ext } = resolved;

  const id = crypto.randomUUID();
  const key = `products/${auth.sub}/${id}.${ext}`;

  try {
    await putProductImageDirect({ key, body: buf, contentType });
  } catch (err) {
    console.error('[upload-image]', err);
    throw new HTTPException(500, {
      message: 'falha ao gravar imagem no R2 — verifique R2_ACCOUNT_ID e credenciais',
    });
  }

  const publicUrl = productImagePublicUrl(key);
  return c.json({ publicUrl, key }, 201);
});

export default app;
