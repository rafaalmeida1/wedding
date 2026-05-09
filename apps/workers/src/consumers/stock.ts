import { KafkaTopics, stockUpdateSchema } from '@repo/shared/events';
import { eq, products, sql } from '@repo/db';
import { buildConsumer } from '../services/kafka.js';
import { db } from '../services/db.js';
import { redis, RedisKeys } from '../services/redis.js';

export async function startStockConsumer() {
  const consumer = await buildConsumer('stock');
  await consumer.subscribe({ topic: KafkaTopics.StockUpdate, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = stockUpdateSchema.parse(JSON.parse(message.value.toString()));
      console.log('[stock-consumer]', event);

      // Atualização atômica protegida pela CHECK constraint (stock >= 0)
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
      // Invalida explicitamente — a próxima leitura pega o Postgres ou recolhe o cache.
      await redis.del(RedisKeys.productStock(event.productId)).catch(() => null);
    },
  });

  return consumer;
}
