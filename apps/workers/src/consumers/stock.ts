import type { ConsumeMessage } from 'amqplib';
import { EventQueues, stockUpdateSchema } from '@repo/shared/events';
import { eq, products, sql } from '@repo/db';
import { assertEventQueues, getConnection } from '../services/rabbitmq.js';
import { db } from '../services/db.js';
import { redis, RedisKeys } from '../services/redis.js';

export async function startStockConsumer(): Promise<{ disconnect: () => Promise<void> }> {
  const conn = await getConnection();
  const ch = await conn.createChannel();
  await assertEventQueues(ch);
  await ch.prefetch(1);

  const { consumerTag } = await ch.consume(
    EventQueues.StockUpdate,
    async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      let event;
      try {
        event = stockUpdateSchema.parse(JSON.parse(msg.content.toString()));
      } catch {
        console.warn('[stock-consumer] dropping invalid payload');
        ch.nack(msg, false, false);
        return;
      }
      console.log('[stock-consumer]', event);

      try {
        const result = await db
          .update(products)
          .set({
            stock: sql`GREATEST(${products.stock} + ${event.delta}, 0)`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, event.productId))
          .returning({ stock: products.stock });

        const newStock = result[0]?.stock ?? 0;
        await redis
          .set(RedisKeys.productStock(event.productId), String(newStock), 'EX', 60)
          .catch(() => null);
        await redis.del(RedisKeys.productStock(event.productId)).catch(() => null);

        ch.ack(msg);
      } catch (err) {
        console.error('[stock-consumer]', (err as Error).message);
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
