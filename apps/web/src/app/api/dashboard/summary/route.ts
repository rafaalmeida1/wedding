import { eq, payments, products, sql } from '@repo/db';
import type { DashboardSummary } from '@repo/shared/payments';
import { getDb } from '@/server/db';
import { jsonErr, jsonOk } from '@/server/http';
import { rateLimitOrNull } from '@/server/rate-limit';
import { getSessionUser } from '@/server/session';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const limited = await rateLimitOrNull(req, '/api/dashboard/summary', 120, 60);
  if (limited) return limited;
  const auth = await getSessionUser();
  if (!auth) return jsonErr('unauthenticated', 401);

  const db = getDb();
  const [pStats] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${payments.amountCents}), 0)`.as('total'),
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(payments)
    .where(eq(payments.userId, auth.sub));

  const [productCount] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(products)
    .where(eq(products.userId, auth.sub));

  const [top] = await db
    .select({
      productId: payments.productId,
      productName: products.name,
      paymentCount: sql<number>`COUNT(*)`.as('payment_count'),
    })
    .from(payments)
    .innerJoin(products, eq(payments.productId, products.id))
    .where(eq(payments.userId, auth.sub))
    .groupBy(payments.productId, products.name)
    .orderBy(sql`payment_count DESC`)
    .limit(1);

  const summary: DashboardSummary = {
    totalReceivedCents: Number(pStats?.total ?? 0),
    paymentCount: Number(pStats?.count ?? 0),
    productCount: Number(productCount?.count ?? 0),
    topProductName: top?.productName ?? null,
  };
  return jsonOk({ summary });
}
