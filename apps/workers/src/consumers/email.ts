import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { emailSendSchema } from '@repo/shared/events';
import { sendEmail } from '../services/ses.js';
import { renderTemplate } from '../templates/index.js';

export async function processEmailJob(job: Job): Promise<void> {
  let event;
  try {
    event = emailSendSchema.parse(job.data);
  } catch {
    console.warn('[jobs:email] dropping invalid payload', job.id);
    throw new UnrecoverableError('invalid email event');
  }

  console.log('[jobs:email]', { to: event.to, template: event.template });
  const rendered = renderTemplate(event);
  await sendEmail({
    to: event.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}
