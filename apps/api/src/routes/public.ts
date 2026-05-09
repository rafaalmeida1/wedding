import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, asc, desc, eq, products, users } from '@repo/db';
import { db } from '../services/db.js';
import type { PublicProduct } from '@repo/shared/products';
import { ensureRedis, redis, RedisKeys } from '../services/redis.js';

const app = new Hono();

const usernameParam = z.object({ username: z.string().min(3).max(32) });

interface PublicCouple {
  username: string;
  name: string;
  avatarUrl: string | null;
}

app.get('/:username', zValidator('param', usernameParam), async (c) => {
  const { username } = c.req.valid('param');
  const [user] = await db
    .select({ id: users.id, username: users.username, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!user) throw new HTTPException(404, { message: 'lista não encontrada' });
  const couple: PublicCouple = {
    username: user.username,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
  return c.json({ couple });
});

app.get('/:username/products', zValidator('param', usernameParam), async (c) => {
  const { username } = c.req.valid('param');
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!user) throw new HTTPException(404, { message: 'lista não encontrada' });

  const rows = await db
    .select()
    .from(products)
    .where(eq(products.userId, user.id))
    .orderBy(asc(products.createdAt));

  const cached = await readStockCache(rows.map((r) => r.id));
  // Preenche cache para os IDs ausentes (write-through, TTL 60s).
  const missing = rows.filter((r) => !cached.has(r.id));
  if (missing.length > 0) {
    await primeStockCache(missing.map((p) => ({ id: p.id, stock: p.stock })));
  }

  const list: PublicProduct[] = rows.map((p) => {
    const stock = cached.get(p.id) ?? p.stock;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      imageUrl: p.imageUrl,
      stock,
      isOutOfStock: stock <= 0,
    };
  });
  return c.json({ products: list });
});

app.get(
  '/:username/products/:id',
  zValidator(
    'param',
    z.object({ username: z.string().min(3).max(32), id: z.string().uuid() }),
  ),
  async (c) => {
    const { username, id } = c.req.valid('param');
    const [row] = await db
      .select({
        product: products,
        owner: { id: users.id, username: users.username, name: users.name },
      })
      .from(products)
      .innerJoin(users, eq(products.userId, users.id))
      .where(and(eq(users.username, username), eq(products.id, id)))
      .limit(1);
    if (!row) throw new HTTPException(404, { message: 'presente não encontrado' });
    const p = row.product;
    const cached = await readStockCache([p.id]);
    const stock = cached.get(p.id) ?? p.stock;
    const product: PublicProduct = {
      id: p.id,
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      imageUrl: p.imageUrl,
      stock,
      isOutOfStock: stock <= 0,
    };
    return c.json({ product, couple: row.owner });
  },
);

async function readStockCache(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  try {
    await ensureRedis();
    const keys = ids.map((id) => RedisKeys.productStock(id));
    const values = await redis.mget(...keys);
    ids.forEach((id, idx) => {
      const v = values[idx];
      if (typeof v === 'string' && v.length > 0) {
        const n = Number(v);
        if (!Number.isNaN(n)) out.set(id, n);
      }
    });
  } catch {
    // ignore
  }
  return out;
}

async function primeStockCache(items: Array<{ id: string; stock: number }>) {
  if (items.length === 0) return;
  try {
    await ensureRedis();
    const pipeline = redis.pipeline();
    for (const it of items) {
      pipeline.set(RedisKeys.productStock(it.id), String(it.stock), 'EX', 60);
    }
    await pipeline.exec();
  } catch {
    // ignore
  }
}

// silenciar warning sobre import não usado (orderBy desc) caso utilizemos depois
void desc;

export default app;
