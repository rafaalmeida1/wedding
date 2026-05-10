import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import {
  emailSendSchema,
  paymentEventSchema,
  stockUpdateSchema,
  type EmailSendPayload,
  type StockUpdatePayload,
} from '@repo/shared/events';
import { eq, products, users } from '@repo/db';
import { db } from '../services/db.js';
import { enqueueEmailJob, enqueueStockJob } from '../jobs/enqueue.js';

export async function processPaymentJob(job: Job): Promise<void> {
  let event;
  try {
    event = paymentEventSchema.parse(job.data);
  } catch {
    console.warn('[jobs:payment] dropping invalid payload', job.id);
    throw new UnrecoverableError('invalid payment event');
  }

  console.log('[jobs:payment]', event.paymentId);

  const stockEvent: StockUpdatePayload = stockUpdateSchema.parse({
    productId: event.productId,
    delta: -1,
    reason: 'payment',
    paymentId: event.paymentId,
  });

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

  await enqueueStockJob(stockEvent);

  if (owner?.email) {
    const emailEvent: EmailSendPayload = emailSendSchema.parse({
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
    await enqueueEmailJob(emailEvent);
  }
}
