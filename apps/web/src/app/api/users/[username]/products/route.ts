import { usernameSchema } from '@repo/shared/auth';
import type { PublicProduct } from '@repo/shared/products';
import { asc, eq, products, users } from '@repo/db';
import { z } from 'zod';
import { getDb } from '@/server/db';
import { jsonErr, jsonOk } from '@/server/http';
import { ensureRedis, getRedis, RedisKeys } from '@/server/redis';
import { rateLimitOrNull } from '@/server/rate-limit';

export const runtime = 'nodejs';

const usernameParam = z.object({ username: usernameSchema });

type Ctx = { params: { username: string } };

async function readStockCache(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (ids.length === 0) return out;
  try {
    await ensureRedis();
    const keys = ids.map((id) => RedisKeys.productStock(id));
    const values = await getRedis().mget(...keys);
    ids.forEach((id, idx) => {
      const v = values[idx];
      if (typeof v === 'string' && v.length > 0) {
        const n = Number(v);
        if (!Number.isNaN(n)) out.set(id, n);
      }
    });
  } catch {
    /* ignore */
  }
  return out;
}

async function primeStockCache(items: Array<{ id: string; stock: number }>) {
  if (items.length === 0) return;
  try {
    await ensureRedis();
    const pipeline = getRedis().pipeline();
    for (const it of items) {
      pipeline.set(RedisKeys.productStock(it.id), String(it.stock), 'EX', 60);
    }
    await pipeline.exec();
  } catch {
    /* ignore */
  }
}

export async function GET(req: Request, { params }: Ctx) {
  const limited = await rateLimitOrNull(req, '/api/users/username/products', 400, 60);
  if (limited) return limited;

  const parsed = usernameParam.safeParse({ username: params.username });
  if (!parsed.success) {
    return jsonErr('username inválido', 400);
  }
  const { username } = parsed.data;

  const db = getDb();
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  if (!user) return jsonErr('lista não encontrada', 404);

  const rows = await db
    .select()
    .from(products)
    .where(eq(products.userId, user.id))
    .orderBy(asc(products.createdAt));

  const cached = await readStockCache(rows.map((r) => r.id));
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
  return jsonOk({ products: list });
}
