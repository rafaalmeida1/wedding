import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import {
  BULL_JOB_PREFIX,
  JobQueues,
  emailSendSchema,
  paymentEventSchema,
  stockUpdateSchema,
  type EmailSendPayload,
  type PaymentEventPayload,
  type StockUpdatePayload,
} from '@repo/shared/events';
import { env } from '../env.js';

const defaultAddOpts = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2500 },
  removeOnComplete: { count: 2000 },
  removeOnFail: { count: 5000 },
};

let bullRedis: Redis | null = null;
const queues = new Map<string, Queue>();

function getBullRedis(): Redis {
  if (!bullRedis) {
    bullRedis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return bullRedis;
}

function getQueue(name: string): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, {
      connection: getBullRedis(),
      prefix: BULL_JOB_PREFIX,
    });
    queues.set(name, q);
  }
  return q;
}

async function addJob(queueName: string, payload: unknown) {
  await getQueue(queueName).add('run', payload, defaultAddOpts);
}

/** Enfileira no Redis (BullMQ) — mesmo contrato que antes (API só publica). */
export async function publishPaymentEvent(payload: PaymentEventPayload) {
  paymentEventSchema.parse(payload);
  try {
    await addJob(JobQueues.PaymentEvents, payload);
  } catch (err) {
    console.error('[jobs] enqueue payment failed:', (err as Error).message);
  }
}

export async function publishStockUpdate(payload: StockUpdatePayload) {
  stockUpdateSchema.parse(payload);
  try {
    await addJob(JobQueues.StockUpdate, payload);
  } catch (err) {
    console.error('[jobs] enqueue stock failed:', (err as Error).message);
  }
}

export async function publishEmailSend(payload: EmailSendPayload) {
  emailSendSchema.parse(payload);
  try {
    await addJob(JobQueues.EmailSend, payload);
  } catch (err) {
    console.error('[jobs] enqueue email failed:', (err as Error).message);
  }
}

/** Fecha cliente Redis só do Bull — não mexe na conexão usada pelo rate-limit. */
export async function disconnectPublisher() {
  await Promise.all(
    [...queues.values()].map((q) =>
      q.close().catch(() => {
        /* ignore */
      }),
    ),
  );
  queues.clear();
  if (bullRedis) {
    await bullRedis.quit().catch(() => null);
    bullRedis = null;
  }
}
