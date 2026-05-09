import {
  KafkaTopics,
  emailSendSchema,
  paymentEventSchema,
  stockUpdateSchema,
  type EmailSendPayload,
  type StockUpdatePayload,
} from '@repo/shared/events';
import { eq, products, users } from '@repo/db';
import { buildConsumer, getProducer } from '../services/kafka.js';
import { db } from '../services/db.js';

export async function startPaymentConsumer() {
  const consumer = await buildConsumer('payment');
  await consumer.subscribe({ topic: KafkaTopics.PaymentEvents, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const json = JSON.parse(message.value.toString());
      const event = paymentEventSchema.parse(json);
      console.log('[payment-consumer] processing', event.paymentId);

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

      const producer = await getProducer();
      await producer.send({
        topic: KafkaTopics.StockUpdate,
        messages: [
          {
            key: stockEvent.productId,
            value: JSON.stringify(stockEvent),
          },
        ],
      });

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
        await producer.send({
          topic: KafkaTopics.EmailSend,
          messages: [{ key: owner.email, value: JSON.stringify(emailEvent) }],
        });
      }
    },
  });

  return consumer;
}
