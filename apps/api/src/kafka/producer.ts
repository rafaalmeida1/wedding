import { Kafka, Producer, logLevel } from 'kafkajs';
import {
  KafkaTopics,
  emailSendSchema,
  paymentEventSchema,
  stockUpdateSchema,
  type EmailSendPayload,
  type PaymentEventPayload,
  type StockUpdatePayload,
} from '@repo/shared/events';
import { env } from '../env.js';

let cachedProducer: Producer | null = null;
let connecting: Promise<Producer> | null = null;
let connectionFailed = false;

function buildKafka() {
  return new Kafka({
    clientId: env.KAFKA_CLIENT_ID,
    brokers: env.KAFKA_BROKERS.split(',').map((b) => b.trim()),
    ssl: env.KAFKA_SSL,
    sasl:
      env.KAFKA_USERNAME && env.KAFKA_PASSWORD
        ? {
            mechanism: 'plain',
            username: env.KAFKA_USERNAME,
            password: env.KAFKA_PASSWORD,
          }
        : undefined,
    logLevel: logLevel.NOTHING,
    connectionTimeout: 5_000,
  });
}

async function getProducer(): Promise<Producer | null> {
  if (cachedProducer) return cachedProducer;
  if (connectionFailed) return null;
  if (!connecting) {
    connecting = (async () => {
      const producer = buildKafka().producer({
        allowAutoTopicCreation: true,
        idempotent: true,
      });
      await producer.connect();
      cachedProducer = producer;
      return producer;
    })().catch((err) => {
      connectionFailed = true;
      console.error('[kafka] producer connect failed:', err.message);
      throw err;
    });
  }
  try {
    return await connecting;
  } catch {
    return null;
  }
}

async function publish(topic: string, key: string, value: unknown) {
  const producer = await getProducer();
  if (!producer) {
    console.warn(`[kafka] producer unavailable; dropping message on ${topic} key=${key}`);
    return;
  }
  await producer.send({
    topic,
    messages: [
      {
        key,
        value: JSON.stringify(value),
        headers: { 'content-type': 'application/json' },
      },
    ],
  });
}

export async function publishPaymentEvent(payload: PaymentEventPayload) {
  paymentEventSchema.parse(payload);
  await publish(KafkaTopics.PaymentEvents, payload.paymentId, payload);
}

export async function publishStockUpdate(payload: StockUpdatePayload) {
  stockUpdateSchema.parse(payload);
  await publish(KafkaTopics.StockUpdate, payload.productId, payload);
}

export async function publishEmailSend(payload: EmailSendPayload) {
  emailSendSchema.parse(payload);
  await publish(KafkaTopics.EmailSend, payload.to, payload);
}

export async function disconnectProducer() {
  if (cachedProducer) {
    await cachedProducer.disconnect().catch(() => null);
    cachedProducer = null;
  }
}
