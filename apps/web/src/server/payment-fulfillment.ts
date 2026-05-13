import { eq, products, sql, users } from '@repo/db';
import type { PaymentMethod } from '@repo/shared/payments';
import { emailSendSchema, type PaymentEventPayload } from '@repo/shared/events';
import { getDb } from './db';
import { sendEmailTransactional } from './email';
import { renderEmailTemplate } from './email-templates';
import { ensureRedis, getRedis, RedisKeys } from './redis';

const FULFILL_TTL_SEC = 60 * 60 * 24 * 7;

/**
 * Garante efeitos de aprovação (stock + e-mail) com idempotência por paymentId.
 */
export async function fulfillApprovedPayment(event: PaymentEventPayload): Promise<void> {
  const lockKey = RedisKeys.paymentFulfilled(event.paymentId);
  try {
    const redis = await ensureRedis();
    const ok = await redis.set(lockKey, '1', 'EX', FULFILL_TTL_SEC, 'NX');
    if (ok !== 'OK') {
      return;
    }
  } catch {
    /* Redis indisponível: segue sem chave de idempotência */
  }

  const db = getDb();
  await db
    .update(products)
    .set({
      stock: sql`GREATEST(${products.stock} + ${-1}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(products.id, event.productId));

  await getRedis()
    .del(RedisKeys.productStock(event.productId))
    .catch(() => null);

  const [product] = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.id, event.productId))
    .limit(1);
  const [owner] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, event.ownerUserId))
    .limit(1);

  if (!owner?.email) return;

  const emailPayload = emailSendSchema.parse({
    to: owner.email,
    template: 'payment-received',
    data: {
      productName: product?.name ?? 'um presente',
      payerName: event.payerName ?? 'Anônimo',
      payerMessage: event.payerMessage ?? '',
      amountCents: event.amountCents,
      ownerName: owner.name,
    },
  });
  const rendered = renderEmailTemplate(emailPayload);
  try {
    await sendEmailTransactional({
      to: emailPayload.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  } catch (err) {
    console.error('[fulfill] email failed', (err as Error).message);
  }
}

export function buildPaymentEvent(args: {
  paymentId: string;
  productId: string;
  ownerUserId: string;
  amountCents: number;
  payerEmail: string | null;
  payerName: string | null;
  payerMessage: string | null;
  paymentMethod: PaymentMethod | null;
}): PaymentEventPayload {
  return {
    paymentId: args.paymentId,
    productId: args.productId,
    ownerUserId: args.ownerUserId,
    amountCents: args.amountCents,
    payerEmail: args.payerEmail,
    payerName: args.payerName,
    payerMessage: args.payerMessage,
    paymentMethod: args.paymentMethod,
    occurredAt: new Date().toISOString(),
  };
}
