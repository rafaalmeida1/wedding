import { Queue } from 'bullmq';
import {
  BULL_JOB_PREFIX,
  JobQueues,
  emailSendSchema,
  stockUpdateSchema,
  type EmailSendPayload,
  type StockUpdatePayload,
} from '@repo/shared/events';
import { getSharedBullRedis } from '../services/redis-bull-shared.js';

const defaultAddOpts = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2500 },
  removeOnComplete: { count: 2000 },
  removeOnFail: { count: 5000 },
};

let stockQueue: Queue | null = null;
let emailQueue: Queue | null = null;

function getStockQueue(): Queue {
  if (!stockQueue) {
    stockQueue = new Queue(JobQueues.StockUpdate, {
      connection: getSharedBullRedis(),
      prefix: BULL_JOB_PREFIX,
    });
  }
  return stockQueue;
}

function getEmailQueue(): Queue {
  if (!emailQueue) {
    emailQueue = new Queue(JobQueues.EmailSend, {
      connection: getSharedBullRedis(),
      prefix: BULL_JOB_PREFIX,
    });
  }
  return emailQueue;
}

export async function enqueueStockJob(payload: StockUpdatePayload) {
  stockUpdateSchema.parse(payload);
  await getStockQueue().add('run', payload, defaultAddOpts);
}

export async function enqueueEmailJob(payload: EmailSendPayload) {
  emailSendSchema.parse(payload);
  await getEmailQueue().add('run', payload, defaultAddOpts);
}

export async function closeEnqueueQueues(): Promise<void> {
  await Promise.all(
    [stockQueue, emailQueue].map((q) =>
      q
        ? q.close().catch(() => {
            /* ignore */
          })
        : Promise.resolve(),
    ),
  );
  stockQueue = null;
  emailQueue = null;
}
