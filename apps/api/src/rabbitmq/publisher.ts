import amqp, { type Channel, type ChannelModel } from 'amqplib';
import {
  EventQueues,
  emailSendSchema,
  paymentEventSchema,
  stockUpdateSchema,
  type EmailSendPayload,
  type PaymentEventPayload,
  type StockUpdatePayload,
} from '@repo/shared/events';
import { env } from '../env.js';

let broker: ChannelModel | null = null;
let channel: Channel | null = null;
let connecting: Promise<Channel> | null = null;
let connectionFailed = false;

async function getPublishChannel(): Promise<Channel | null> {
  if (channel) return channel;
  if (connectionFailed) return null;
  if (!connecting) {
    connecting = (async () => {
      broker = await amqp.connect(env.RABBITMQ_URL);
      broker.on('error', (err: Error) => {
        console.error('[rabbitmq] broker error:', err.message);
      });
      broker.on('close', () => {
        broker = null;
        channel = null;
      });
      const ch = await broker.createChannel();
      await Promise.all(
        Object.values(EventQueues).map((q) => ch.assertQueue(q, { durable: true })),
      );
      channel = ch;
      return ch;
    })().catch((err) => {
      connectionFailed = true;
      connecting = null;
      channel = null;
      broker = null;
      console.error('[rabbitmq] connect failed:', (err as Error).message);
      throw err;
    });
  }
  try {
    return await connecting;
  } catch {
    return null;
  }
}

async function publish(queue: string, body: unknown) {
  const ch = await getPublishChannel();
  if (!ch) {
    console.warn(`[rabbitmq] publisher unavailable; dropping message on queue=${queue}`);
    return;
  }
  ch.sendToQueue(queue, Buffer.from(JSON.stringify(body)), { persistent: true });
}

export async function publishPaymentEvent(payload: PaymentEventPayload) {
  paymentEventSchema.parse(payload);
  await publish(EventQueues.PaymentEvents, payload);
}

export async function publishStockUpdate(payload: StockUpdatePayload) {
  stockUpdateSchema.parse(payload);
  await publish(EventQueues.StockUpdate, payload);
}

export async function publishEmailSend(payload: EmailSendPayload) {
  emailSendSchema.parse(payload);
  await publish(EventQueues.EmailSend, payload);
}

export async function disconnectPublisher() {
  try {
    await channel?.close();
  } catch {
    // ignore
  }
  try {
    await broker?.close();
  } catch {
    // ignore
  }
  channel = null;
  broker = null;
  connecting = null;
  connectionFailed = false;
}
