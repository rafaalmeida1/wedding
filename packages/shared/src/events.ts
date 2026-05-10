import { z } from 'zod';

/** Prefixo Redis BullMQ (compartilhado API + workers). */
export const BULL_JOB_PREFIX = 'wedding:jobs';

/** Nomes das filas BullMQ (persistem no mesmo Redis das demais operações da app). */
export const JobQueues = {
  PaymentEvents: 'payment.events',
  StockUpdate: 'stock.update',
  EmailSend: 'email.send',
} as const;

export type JobQueueName = (typeof JobQueues)[keyof typeof JobQueues];

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
