import { productUpdateSchema, type OwnerProduct } from '@repo/shared/products';
import { and, eq, payments, products, sql } from '@repo/db';
import { z } from 'zod';
import { getDb } from '@/server/db';
import { jsonErr, jsonOk } from '@/server/http';
import { rateLimitOrNull } from '@/server/rate-limit';
import { ensureRedis, getRedis, RedisKeys } from '@/server/redis';
import { getSessionUser } from '@/server/session';
import { tryDeleteProductImage } from '@/server/r2';

export const runtime = 'nodejs';

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

async function invalidateStockCache(productId: string) {
  try {
    await ensureRedis();
    await getRedis().del(RedisKeys.productStock(productId));
  } catch {
    /* ignore */
  }
}

type Ctx = { params: { id: string } };

export async function GET(req: Request, { params }: Ctx) {
  const parsedId = idParam.safeParse({ id: params.id });
  if (!parsedId.success) return jsonErr('invalid id', 400);
  const limited = await rateLimitOrNull(req, '/api/products/id', 60, 60);
  if (limited) return limited;
  const auth = await getSessionUser();
  if (!auth) return jsonErr('unauthenticated', 401);
  const { id } = parsedId.data;
  const db = getDb();
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.userId, auth.sub)))
    .limit(1);
  if (!row) return jsonErr('product not found', 404);
  return jsonOk({ product: toOwnerProduct(row) });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const parsedId = idParam.safeParse({ id: params.id });
  if (!parsedId.success) return jsonErr('invalid id', 400);
  const limited = await rateLimitOrNull(req, '/api/products/id', 60, 60);
  if (limited) return limited;
  const auth = await getSessionUser();
  if (!auth) return jsonErr('unauthenticated', 401);
  const { id } = parsedId.data;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('invalid json', 400);
  }
  const parsed = productUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr('validação falhou', 400);
  }
  const input = parsed.data;
  const db = getDb();
  const [existing] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.userId, auth.sub)))
    .limit(1);
  if (!existing) return jsonErr('product not found', 404);
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
  if (!updated) return jsonErr('product not found', 404);
  await invalidateStockCache(id);
  if (input.imageUrl !== undefined && input.imageUrl !== previousImageUrl && previousImageUrl) {
    await tryDeleteProductImage(previousImageUrl);
  }
  return jsonOk({ product: toOwnerProduct(updated) });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const parsedId = idParam.safeParse({ id: params.id });
  if (!parsedId.success) return jsonErr('invalid id', 400);
  const limited = await rateLimitOrNull(req, '/api/products/id', 60, 60);
  if (limited) return limited;
  const auth = await getSessionUser();
  if (!auth) return jsonErr('unauthenticated', 401);
  const { id } = parsedId.data;
  const db = getDb();
  const [existing] = await db
    .select({ id: products.id, imageUrl: products.imageUrl })
    .from(products)
    .where(and(eq(products.id, id), eq(products.userId, auth.sub)))
    .limit(1);
  if (!existing) return jsonErr('product not found', 404);

  const countRows = await db
    .select({ n: sql<number>`cast(count(*) as int)` })
    .from(payments)
    .where(eq(payments.productId, id));
  const paymentCount = countRows[0]?.n ?? 0;
  if (paymentCount > 0) {
    return jsonErr(
      'Este presente não pode ser excluído porque já tem pagamentos registrados. Defina estoque a 0 para esconder da venda ou edite os dados.',
      409,
    );
  }

  try {
    await db.delete(products).where(eq(products.id, id));
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: unknown }).code)
        : '';
    if (code === '23503') {
      return jsonErr(
        'Este presente não pode ser excluído porque está ligado a pagamentos.',
        409,
      );
    }
    throw err;
  }
  await tryDeleteProductImage(existing.imageUrl);
  await invalidateStockCache(id);
  return jsonOk({ ok: true });
}
