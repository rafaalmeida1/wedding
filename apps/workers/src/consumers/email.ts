import { KafkaTopics, emailSendSchema } from '@repo/shared/events';
import { buildConsumer } from '../services/kafka.js';
import { sendEmail } from '../services/ses.js';
import { renderTemplate } from '../templates/index.js';

export async function startEmailConsumer() {
  const consumer = await buildConsumer('email');
  await consumer.subscribe({ topic: KafkaTopics.EmailSend, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const event = emailSendSchema.parse(JSON.parse(message.value.toString()));
      console.log('[email-consumer]', { to: event.to, template: event.template });
      const rendered = renderTemplate(event);
      await sendEmail({
        to: event.to,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
    },
  });

  return consumer;
}
