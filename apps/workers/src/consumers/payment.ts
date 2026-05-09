import {
  EventQueues,
  emailSendSchema,
  paymentEventSchema,
  stockUpdateSchema,
  type EmailSendPayload,
  type StockUpdatePayload,
} from '@repo/shared/events';
import type { ConsumeMessage } from 'amqplib';
import { eq, products, users } from '@repo/db';
import { assertEventQueues, getConnection, publishJson } from '../services/rabbitmq.js';
import { db } from '../services/db.js';

export async function startPaymentConsumer(): Promise<{ disconnect: () => Promise<void> }> {
  const conn = await getConnection();
  const ch = await conn.createChannel();
  await assertEventQueues(ch);
  await ch.prefetch(1);

  const { consumerTag } = await ch.consume(
    EventQueues.PaymentEvents,
    async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      let event;
      try {
        event = paymentEventSchema.parse(JSON.parse(msg.content.toString()));
      } catch {
        console.warn('[payment-consumer] dropping invalid payload');
        ch.nack(msg, false, false);
        return;
      }

      console.log('[payment-consumer] processing', event.paymentId);

      try {
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

        publishJson(ch, EventQueues.StockUpdate, stockEvent);

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
          publishJson(ch, EventQueues.EmailSend, emailEvent);
        }

        ch.ack(msg);
      } catch (err) {
        console.error('[payment-consumer]', (err as Error).message);
        ch.nack(msg, false, true);
      }
    },
    { noAck: false },
  );

  return {
    disconnect: async () => {
      await ch.cancel(consumerTag);
      await ch.close().catch(() => null);
    },
  };
}
