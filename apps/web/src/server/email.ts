import nodemailer, { type Transporter } from 'nodemailer';
import { getEnv } from './env';

let cached: Transporter | null = null;

function transporter(): Transporter {
  if (cached) return cached;
  const env = getEnv();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new Error('SMTP credentials not configured');
  }
  cached = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  return cached;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmailTransactional(args: SendArgs) {
  const env = getEnv();
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    console.log('[smtp] missing credentials, would send:', {
      to: args.to,
      subject: args.subject,
    });
    return { dev: true } as const;
  }
  const from = env.SMTP_FROM_NAME
    ? `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`
    : env.SMTP_FROM_EMAIL;
  await transporter().sendMail({
    from,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });
  return { dev: false } as const;
}
