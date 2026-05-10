import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { stockUpdateSchema } from '@repo/shared/events';
import { eq, products, sql } from '@repo/db';
import { db } from '../services/db.js';
import { redis, RedisKeys } from '../services/redis.js';

export async function processStockJob(job: Job): Promise<void> {
  let event;
  try {
    event = stockUpdateSchema.parse(job.data);
  } catch {
    console.warn('[jobs:stock] dropping invalid payload', job.id);
    throw new UnrecoverableError('invalid stock event');
  }

  console.log('[jobs:stock]', event);

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
}
