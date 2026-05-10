import { Redis } from 'ioredis';
import { Worker } from 'bullmq';
import { JobQueues } from '@repo/shared/events';
import { env } from './env.js';
import { getSharedBullRedis, quitSharedBullRedis } from './services/redis-bull-shared.js';
import { closeEnqueueQueues } from './jobs/enqueue.js';
import { processPaymentJob } from './consumers/payment.js';
import { processStockJob } from './consumers/stock.js';
import { processEmailJob } from './consumers/email.js';

function dupConnection(): Redis {
  const base = getSharedBullRedis();
  return base.duplicate({ maxRetriesPerRequest: null });
}

async function main() {
  console.log('[workers] starting BullMQ workers (Redis)...');
  const shared = getSharedBullRedis();
  await shared.ping().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[workers] Redis indisponível:', msg);
    throw err;
  });

  const conc = env.WORKERS_CONCURRENCY;
  const workers = [
    new Worker(JobQueues.PaymentEvents, processPaymentJob, {
      connection: dupConnection(),
      concurrency: conc,
    }),
    new Worker(JobQueues.StockUpdate, processStockJob, {
      connection: dupConnection(),
      concurrency: conc,
    }),
    new Worker(JobQueues.EmailSend, processEmailJob, {
      connection: dupConnection(),
      concurrency: conc,
    }),
  ];

  workers.forEach((w) => {
    w.on('failed', (job, err) =>
      console.error('[workers] failed', job?.name, job?.id, err?.message),
    );
  });

  console.log('[workers] all workers listening. Ctrl+C to stop.');

  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`[workers] ${signal}, closing…`);
    await Promise.all(workers.map((w) => w.close().catch(() => null)));
    await closeEnqueueQueues().catch(() => null);
    await quitSharedBullRedis().catch(() => null);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[workers] fatal', err);
  process.exit(1);
});
