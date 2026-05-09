import { z } from 'zod';

/** Filas RabbitMQ duráveis (nomes herdados do modelo antigo tipo Kafka topics). */
export const EventQueues = {
  PaymentEvents: 'payment.events',
  StockUpdate: 'stock.update',
  EmailSend: 'email.send',
} as const;

export type EventQueueName = (typeof EventQueues)[keyof typeof EventQueues];

export const paymentEventSchema = z.object({
  paymentId: z.string().uuid(),
  productId: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  payerEmail: z.string().email().nullable(),
  payerName: z.string().nullable(),
  payerMessage: z.string().nullable(),
  paymentMethod: z.enum(['card', 'pix', 'boleto', 'debit_caixa']).nullable(),
  occurredAt: z.string().datetime(),
});

export const stockUpdateSchema = z.object({
  productId: z.string().uuid(),
  delta: z.number().int(),
  reason: z.enum(['payment', 'admin', 'refund']).default('payment'),
  paymentId: z.string().uuid().optional(),
});

export const emailSendSchema = z.object({
  to: z.string().email(),
  template: z.enum(['payment-received', 'password-reset', 'welcome']),
  data: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export type PaymentEventPayload = z.infer<typeof paymentEventSchema>;
export type StockUpdatePayload = z.infer<typeof stockUpdateSchema>;
export type EmailSendPayload = z.infer<typeof emailSendSchema>;
