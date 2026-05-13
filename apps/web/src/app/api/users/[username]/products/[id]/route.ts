import { usernameSchema } from '@repo/shared/auth';
import type { PublicProduct } from '@repo/shared/products';
import { and, eq, products, users } from '@repo/db';
import { z } from 'zod';
import { getDb } from '@/server/db';
import { jsonErr, jsonOk } from '@/server/http';
import { ensureRedis, getRedis, RedisKeys } from '@/server/redis';
import { rateLimitOrNull } from '@/server/rate-limit';

export const runtime = 'nodejs';

const paramSchema = z.object({ username: usernameSchema, id: z.string().uuid() });

type Ctx = { params: { username: string; id: string } };

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

export async function GET(req: Request, { params }: Ctx) {
  const limited = await rateLimitOrNull(req, '/api/users/username/products/id', 400, 60);
  if (limited) return limited;

  const parsed = paramSchema.safeParse({ username: params.username, id: params.id });
  if (!parsed.success) {
    return jsonErr('parâmetros inválidos', 400);
  }
  const { username, id } = parsed.data;

  const db = getDb();
  const [row] = await db
    .select({
      product: products,
      owner: { id: users.id, username: users.username, name: users.name },
    })
    .from(products)
    .innerJoin(users, eq(products.userId, users.id))
    .where(and(eq(users.username, username), eq(products.id, id)))
    .limit(1);
  if (!row) return jsonErr('presente não encontrado', 404);
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
  return jsonOk({ product, couple: row.owner });
}
