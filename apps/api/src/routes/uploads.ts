import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import crypto from 'node:crypto';
import { presignedUrlSchema, type PresignedUrlResponse } from '@repo/shared/products';
import { presignR2Upload } from '../services/r2.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';

const app = new Hono<AuthContext>();

const EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

app.post(
  '/presigned-url',
  requireAuth,
  zValidator('json', presignedUrlSchema),
  async (c) => {
    const auth = c.get('user');
    const { contentType, size } = c.req.valid('json');
    const id = crypto.randomUUID();
    const ext = EXT_MAP[contentType];
    if (!ext) {
      throw new HTTPException(400, { message: 'tipo de arquivo não permitido' });
    }
    const key = `products/${auth.sub}/${id}.${ext}`;
    const presigned = await presignR2Upload({
      key,
      contentType,
      contentLength: size,
    });
    const response: PresignedUrlResponse = {
      uploadUrl: presigned.uploadUrl,
      publicUrl: presigned.publicUrl,
      key,
      expiresIn: presigned.expiresIn,
    };
    return c.json(response);
  },
);

export default app;
