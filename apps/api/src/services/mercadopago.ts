// Mercado Pago — Checkout Transparente
// Documentação: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing
//
// Usamos o endpoint clássico `/v1/payments` (classe `Payment` do SDK) porque é
// o que o Payment Brick alimenta naturalmente via `formData`. Tudo (cartão,
// PIX, boleto, débito virtual Caixa) passa pelo mesmo endpoint, mudando apenas
// o `payment_method_id` / `payment_type_id`.

import crypto from 'node:crypto';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { env } from '../env.js';

// Tipo flexível para a resposta da MP. Os campos abaixo são os que efetivamente
// usamos; o restante chega como `Record<string, unknown>` e é seguro ignorar.
// Documentação: https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
export interface MpPaymentResponse {
  id: number;
  status: 'approved' | 'pending' | 'in_process' | 'rejected' | 'cancelled' | 'refunded' | 'charged_back' | 'authorized';
  status_detail: string;
  payment_method_id?: string;
  payment_type_id?: string;
  transaction_amount?: number;
  date_of_expiration?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
      bank_transfer_id?: string;
    };
  };
  transaction_details?: {
    external_resource_url?: string;
    verification_code?: string;
  };
  barcode?: { content?: string } | null;
  metadata?: Record<string, unknown>;
  payer?: { email?: string; first_name?: string; last_name?: string };
  description?: string;
}

let cachedConfig: MercadoPagoConfig | null = null;

function client(): MercadoPagoConfig {
  if (cachedConfig) return cachedConfig;
  if (!env.MP_ACCESS_TOKEN || env.MP_ACCESS_TOKEN.startsWith('TEST-replace')) {
    throw new Error(
      'MP_ACCESS_TOKEN not configured. Defina em .env (TEST-... em sandbox, APP_USR-... em produção).',
    );
  }
  cachedConfig = new MercadoPagoConfig({
    accessToken: env.MP_ACCESS_TOKEN,
    options: { timeout: 8_000 },
  });
  return cachedConfig;
}

export function paymentClient(): Payment {
  return new Payment(client());
}

// ----- Criação de pagamento ---------------------------------------------------

interface CreateMpPaymentArgs {
  amountCents: number;
  description: string;
  // Dados do pagador
  payerEmail: string;
  payerName: string;
  payerCpf: string; // só dígitos
  payerCpfType: 'CPF' | 'CNPJ';
  // Dados do método (vindo do Brick)
  token?: string;
  installments?: number;
  paymentMethodId: string;
  paymentTypeId?: string;
  issuerId?: string;
  // Metadata persistida no MP (sobe nos webhooks)
  metadata: Record<string, string | number | undefined | null>;
  // Idempotência
  idempotencyKey: string;
}

export async function createMpPayment(args: CreateMpPaymentArgs): Promise<MpPaymentResponse> {
  const amount = +(args.amountCents / 100).toFixed(2);
  const [firstName, ...rest] = args.payerName.trim().split(/\s+/);
  const lastName = rest.join(' ') || undefined;

  const body: Record<string, unknown> = {
    transaction_amount: amount,
    description: args.description,
    payment_method_id: args.paymentMethodId,
    installments: args.installments ?? 1,
    statement_descriptor: env.MP_STATEMENT_DESCRIPTOR,
    payer: {
      email: args.payerEmail,
      first_name: firstName,
      last_name: lastName,
      identification: {
        type: args.payerCpfType,
        number: args.payerCpf,
      },
    },
    metadata: Object.fromEntries(
      Object.entries(args.metadata).filter(([, v]) => v !== undefined && v !== null),
    ),
  };

  if (args.token) body.token = args.token;
  if (args.issuerId) body.issuer_id = args.issuerId;
  if (env.MP_NOTIFICATION_URL) body.notification_url = env.MP_NOTIFICATION_URL;

  const response = await paymentClient().create({
    body: body as never,
    requestOptions: { idempotencyKey: args.idempotencyKey },
  });
  return response as unknown as MpPaymentResponse;
}

// ----- Consulta -------------------------------------------------------------

export async function getMpPayment(id: string | number): Promise<MpPaymentResponse> {
  const result = await paymentClient().get({ id });
  return result as unknown as MpPaymentResponse;
}

// ----- Validação de webhook -------------------------------------------------

// MP envia o header `x-signature` no formato:
//   ts=1700000000,v1=hex_hash
// O hash é HMAC-SHA256 da string:
//   `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
// Documentação:
// https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks#bookmark_seguran%C3%A7a
export interface VerifyWebhookArgs {
  signatureHeader: string | undefined;
  requestIdHeader: string | undefined;
  dataId: string;
  secret?: string;
}

export function verifyMpWebhook({
  signatureHeader,
  requestIdHeader,
  dataId,
  secret = env.MP_WEBHOOK_SECRET,
}: VerifyWebhookArgs): boolean {
  if (!secret) {
    // Em dev, sem secret configurada, aceitamos para facilitar testes locais.
    console.warn('[mp-webhook] MP_WEBHOOK_SECRET vazio — assinatura NÃO validada');
    return true;
  }
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => {
      const [k, v] = p.trim().split('=');
      return [k, v ?? ''];
    }),
  ) as { ts?: string; v1?: string };

  if (!parts.ts || !parts.v1) return false;

  const manifest =
    `id:${dataId};` +
    (requestIdHeader ? `request-id:${requestIdHeader};` : '') +
    `ts:${parts.ts};`;

  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  // Comparação resistente a timing attacks
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(parts.v1, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
