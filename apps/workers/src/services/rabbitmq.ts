import amqp, { type Channel, type ChannelModel } from 'amqplib';
import { EventQueues } from '@repo/shared/events';
import { env } from '../env.js';

/** Tentativas ao subir (Coolify/race: healthcheck passa antes do AMQP aceitar em 5672). */
const CONNECT_RETRIES = 40;
const CONNECT_DELAY_MS = 2500;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

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

async function connectWithRetry(): Promise<ChannelModel> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= CONNECT_RETRIES; attempt++) {
    try {
      const br = await amqp.connect(env.RABBITMQ_URL);
      if (attempt > 1) {
        console.log(`[rabbitmq] connected on attempt ${attempt}`);
      }
      return br;
    } catch (err) {
      lastErr = err;
      const code = (err as NodeJS.ErrnoException)?.code;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[rabbitmq] connect ${attempt}/${CONNECT_RETRIES} failed (${code ?? 'ERR'}): ${msg}`,
      );
      if (attempt < CONNECT_RETRIES) await sleep(CONNECT_DELAY_MS);
    }
  }
  console.error(
    `[rabbitmq] giving up after ${CONNECT_RETRIES} attempts — check RABBITMQ_URL, rede Docker/Coolify e se o broker escuta em 5672`,
  );
  throw lastErr;
}

export async function getConnection(): Promise<ChannelModel> {
  if (broker) return broker;
  if (!connecting) {
    connecting = connectWithRetry()
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
