import { productCreateSchema, type OwnerProduct } from '@repo/shared/products';
import { desc, eq, products } from '@repo/db';
import { getDb } from '@/server/db';
import { jsonErr, jsonOk } from '@/server/http';
import { rateLimitOrNull } from '@/server/rate-limit';
import { getSessionUser } from '@/server/session';

export const runtime = 'nodejs';

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

async function requireUser(req: Request) {
  const limited = await rateLimitOrNull(req, '/api/products', 60, 60);
  if (limited) return { error: limited };
  const auth = await getSessionUser();
  if (!auth) {
    return { error: jsonErr('unauthenticated', 401) };
  }
  return { auth };
}

export async function GET(req: Request) {
  const r = await requireUser(req);
  if ('error' in r && r.error) return r.error;
  const { auth } = r as { auth: NonNullable<Awaited<ReturnType<typeof getSessionUser>>> };
  const db = getDb();
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.userId, auth.sub))
    .orderBy(desc(products.createdAt));
  return jsonOk({ products: rows.map(toOwnerProduct) });
}

export async function POST(req: Request) {
  const r = await requireUser(req);
  if ('error' in r && r.error) return r.error;
  const { auth } = r as { auth: NonNullable<Awaited<ReturnType<typeof getSessionUser>>> };

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('invalid json', 400);
  }
  const parsed = productCreateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr('validação falhou', 400);
  }
  const input = parsed.data;
  const db = getDb();
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
  if (!created) return jsonErr('failed to create product', 500);
  return jsonOk({ product: toOwnerProduct(created) }, { status: 201 });
}
