import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  productCreateSchema,
  productUpdateSchema,
  type OwnerProduct,
} from '@repo/shared/products';
import { and, desc, eq, products } from '@repo/db';
import { db } from '../services/db.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';
import { ensureRedis, redis, RedisKeys } from '../services/redis.js';
import { tryDeleteProductImage } from '../services/r2.js';

const app = new Hono<AuthContext>();

const idParam = z.object({ id: z.string().uuid() });

function toOwnerProduct(p: typeof products.$inferSelect): OwnerProduct {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    priceCents: p.priceCents,
    imageUrl: p.imageUrl,
    stock: p.stock,
    isOutOfStock: p.stock <= 0,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

app.use('*', requireAuth);

app.get('/', async (c) => {
  const auth = c.get('user');
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.userId, auth.sub))
    .orderBy(desc(products.createdAt));
  return c.json({ products: rows.map(toOwnerProduct) });
});

app.post('/', zValidator('json', productCreateSchema), async (c) => {
  const auth = c.get('user');
  const input = c.req.valid('json');
  const [created] = await db
    .insert(products)
    .values({
      userId: auth.sub,
      name: input.name,
      description: input.description ?? null,
      priceCents: input.priceCents,
      imageUrl: input.imageUrl,
      stock: input.stock,
    })
    .returning();
  if (!created) throw new HTTPException(500, { message: 'failed to create product' });
  return c.json({ product: toOwnerProduct(created) }, 201);
});

app.get('/:id', zValidator('param', idParam), async (c) => {
  const auth = c.get('user');
  const { id } = c.req.valid('param');
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.userId, auth.sub)))
    .limit(1);
  if (!row) throw new HTTPException(404, { message: 'product not found' });
  return c.json({ product: toOwnerProduct(row) });
});

app.patch(
  '/:id',
  zValidator('param', idParam),
  zValidator('json', productUpdateSchema),
  async (c) => {
    const auth = c.get('user');
    const { id } = c.req.valid('param');
    const input = c.req.valid('json');
    const [existing] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.userId, auth.sub)))
      .limit(1);
    if (!existing) throw new HTTPException(404, { message: 'product not found' });
    const previousImageUrl = existing.imageUrl;
    const [updated] = await db
      .update(products)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.stock !== undefined ? { stock: input.stock } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(products.id, id), eq(products.userId, auth.sub)))
      .returning();
    if (!updated) throw new HTTPException(404, { message: 'product not found' });
    await invalidateStockCache(id);
    if (
      input.imageUrl !== undefined &&
      input.imageUrl !== previousImageUrl &&
      previousImageUrl
    ) {
      await tryDeleteProductImage(previousImageUrl);
    }
    return c.json({ product: toOwnerProduct(updated) });
  },
);

app.delete('/:id', zValidator('param', idParam), async (c) => {
  const auth = c.get('user');
  const { id } = c.req.valid('param');
  const [existing] = await db
    .select({ id: products.id, imageUrl: products.imageUrl })
    .from(products)
    .where(and(eq(products.id, id), eq(products.userId, auth.sub)))
    .limit(1);
  if (!existing) throw new HTTPException(404, { message: 'product not found' });
  await db.delete(products).where(eq(products.id, id));
  await tryDeleteProductImage(existing.imageUrl);
  await invalidateStockCache(id);
  return c.json({ ok: true });
});

async function invalidateStockCache(productId: string) {
  try {
    await ensureRedis();
    await redis.del(RedisKeys.productStock(productId));
  } catch {
    // ignore
  }
}

export default app;
