import type { ConsumeMessage } from 'amqplib';
import { EventQueues, emailSendSchema } from '@repo/shared/events';
import { assertEventQueues, getConnection } from '../services/rabbitmq.js';
import { sendEmail } from '../services/ses.js';
import { renderTemplate } from '../templates/index.js';

export async function startEmailConsumer(): Promise<{ disconnect: () => Promise<void> }> {
  const conn = await getConnection();
  const ch = await conn.createChannel();
  await assertEventQueues(ch);
  await ch.prefetch(1);

  const { consumerTag } = await ch.consume(
    EventQueues.EmailSend,
    async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      let event;
      try {
        event = emailSendSchema.parse(JSON.parse(msg.content.toString()));
      } catch {
        console.warn('[email-consumer] dropping invalid payload');
        ch.nack(msg, false, false);
        return;
      }
      console.log('[email-consumer]', { to: event.to, template: event.template });

      try {
        const rendered = renderTemplate(event);
        await sendEmail({
          to: event.to,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
        ch.ack(msg);
      } catch (err) {
        console.error('[email-consumer]', (err as Error).message);
        ch.nack(msg, false, true);
      }
    },
    { noAck: false },
  );

  return {
    disconnect: async () => {
      await ch.cancel(consumerTag);
      await ch.close().catch(() => null);
    },
  };
}
