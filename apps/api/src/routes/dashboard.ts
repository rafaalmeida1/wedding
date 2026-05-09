import { Hono } from 'hono';
import { eq, payments, products, sql } from '@repo/db';
import { db } from '../services/db.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';
import type { DashboardSummary } from '@repo/shared/payments';

const app = new Hono<AuthContext>();

app.get('/summary', requireAuth, async (c) => {
  const auth = c.get('user');

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
  return c.json({ summary });
});

export default app;
