import { Kafka, Consumer, Producer, logLevel } from 'kafkajs';
import { env } from '../env.js';

let kafka: Kafka | null = null;

export function getKafka(): Kafka {
  if (kafka) return kafka;
  kafka = new Kafka({
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
    logLevel: logLevel.ERROR,
    connectionTimeout: 5_000,
    retry: { retries: 8 },
  });
  return kafka;
}

let cachedProducer: Producer | null = null;

export async function getProducer(): Promise<Producer> {
  if (cachedProducer) return cachedProducer;
  const producer = getKafka().producer({ allowAutoTopicCreation: true, idempotent: true });
  await producer.connect();
  cachedProducer = producer;
  return producer;
}

export async function buildConsumer(groupSuffix: string): Promise<Consumer> {
  const consumer = getKafka().consumer({
    groupId: `${env.KAFKA_GROUP_ID}-${groupSuffix}`,
    sessionTimeout: 30_000,
    rebalanceTimeout: 60_000,
  });
  await consumer.connect();
  return consumer;
}
