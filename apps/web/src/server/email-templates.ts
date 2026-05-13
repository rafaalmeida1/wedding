import type { EmailSendPayload } from '@repo/shared/events';
import { getEnv } from './env';

interface TemplateOutput {
  subject: string;
  html: string;
  text: string;
}

function layout(title: string, body: string) {
  const { APP_URL } = getEnv();
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#FBF7F4; padding:32px;">
  <table role="presentation" width="100%" style="max-width:560px; margin:0 auto; background:#fff; border-radius:24px; padding:32px; border:1px solid #FCE4EC;">
    <tr><td>
      <h1 style="font-family: Georgia, 'Times New Roman', serif; color:#C2185B; margin:0 0 16px 0; font-size:28px;">${title}</h1>
      ${body}
      <hr style="border:none; border-top:1px solid #FCE4EC; margin:32px 0;" />
      <p style="color:#6E6577; font-size:12px; margin:0;">Lista de Presentes &middot; <a href="${APP_URL}" style="color:#C2185B;">${APP_URL}</a></p>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

function brl(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    cents / 100,
  );
}

export function renderEmailTemplate(payload: EmailSendPayload): TemplateOutput {
  const { APP_URL } = getEnv();
  switch (payload.template) {
    case 'payment-received': {
      const productName = asString(payload.data.productName);
      const payerName = asString(payload.data.payerName);
      const message = asString(payload.data.payerMessage);
      const amount = brl(asNumber(payload.data.amountCents));
      const subject = `Você recebeu um presente — ${productName}`;
      const body = `
        <p style="color:#1F1B24; font-size:16px; line-height:1.6;">
          Boas notícias! <strong>${payerName}</strong> presenteou vocês com
          <strong>${productName}</strong> no valor de <strong>${amount}</strong>.
        </p>
        ${
          message
            ? `<blockquote style="border-left:3px solid #C2185B; padding:8px 16px; margin:24px 0; color:#3A323F; font-style:italic;">"${message}"</blockquote>`
            : ''
        }
        <p>
          <a href="${APP_URL}/dashboard/payments" style="display:inline-block; background:#C2185B; color:#fff; padding:12px 24px; border-radius:999px; text-decoration:none;">Ver no painel</a>
        </p>
      `;
      return {
        subject,
        html: layout('✦ Você foi presenteado!', body),
        text: `${payerName} presenteou vocês com ${productName} (${amount}). ${message ? `Mensagem: ${message}` : ''} Acesse ${APP_URL}/dashboard/payments`,
      };
    }
    case 'password-reset': {
      const link = asString(payload.data.link);
      const name = asString(payload.data.name) || 'amigos';
      const subject = 'Redefinição de senha';
      const body = `
        <p style="color:#1F1B24; font-size:16px; line-height:1.6;">Olá, ${name}!</p>
        <p style="color:#1F1B24; font-size:16px; line-height:1.6;">
          Recebemos um pedido para redefinir a senha da sua lista. O link expira em 1 hora.
        </p>
        <p>
          <a href="${link}" style="display:inline-block; background:#C2185B; color:#fff; padding:12px 24px; border-radius:999px; text-decoration:none;">Redefinir senha</a>
        </p>
        <p style="color:#6E6577; font-size:13px;">Se você não solicitou, pode ignorar este e-mail.</p>
      `;
      return {
        subject,
        html: layout('Redefinir senha', body),
        text: `Redefina sua senha em até 1 hora: ${link}`,
      };
    }
    case 'welcome': {
      const name = asString(payload.data.name);
      const username = asString(payload.data.username);
      const subject = 'Sua lista de presentes está pronta';
      const body = `
        <p style="color:#1F1B24; font-size:16px; line-height:1.6;">Olá, ${name}!</p>
        <p style="color:#1F1B24; font-size:16px; line-height:1.6;">
          Sua lista pública está em <a href="${APP_URL}/${username}" style="color:#C2185B;">${APP_URL}/${username}</a>.
        </p>
      `;
      return {
        subject,
        html: layout('Bem-vindos!', body),
        text: `Sua lista pública: ${APP_URL}/${username}`,
      };
    }
  }
}
