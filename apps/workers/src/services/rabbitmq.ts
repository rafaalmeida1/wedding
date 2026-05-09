import amqp, { type Channel, type ChannelModel } from 'amqplib';
import { EventQueues } from '@repo/shared/events';
import { env } from '../env.js';

let broker: ChannelModel | null = null;
let connecting: Promise<ChannelModel> | null = null;

function attachBrokerHooks(br: ChannelModel) {
  br.on('error', (err: Error) => {
    console.error('[rabbitmq] broker error', err.message);
  });
  br.on('close', () => {
    broker = null;
  });
}

export async function getConnection(): Promise<ChannelModel> {
  if (broker) return broker;
  if (!connecting) {
    connecting = amqp
      .connect(env.RABBITMQ_URL)
      .then((br) => {
        broker = br;
        attachBrokerHooks(br);
        connecting = null;
        return br;
      })
      .catch((err) => {
        connecting = null;
        throw err;
      });
  }
  return connecting;
}

export async function assertEventQueues(channel: Channel) {
  await Promise.all(
    Object.values(EventQueues).map((q) => channel.assertQueue(q, { durable: true })),
  );
}

/** Publica JSON numa fila durável (no worker, mesmo canal que consome só após prefetch/sem concorrência). */
export function publishJson(channel: Channel, queue: string, payload: unknown) {
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)), { persistent: true });
}

export async function closeConnection() {
  if (broker) {
    await broker.close().catch(() => null);
    broker = null;
  }
  connecting = null;
}
