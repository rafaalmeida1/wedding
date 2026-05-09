import { z } from 'zod';

// =============================================================================
// Tipos compartilhados — Mercado Pago Checkout Transparente
// =============================================================================
//
// O fluxo é:
// 1. Frontend renderiza o Payment Brick (`@mercadopago/sdk-react`).
// 2. Brick coleta dados do cartão e gera um `token` localmente (cartão) ou
//    apenas seleciona método (PIX/boleto/débito virtual Caixa).
// 3. `onSubmit` retorna um `formData` que reencapsulamos em `CreatePaymentInput`
//    e enviamos para `POST /api/payments`.
// 4. Backend chama Mercado Pago (`/v1/payments`) e devolve `CreatePaymentResult`.
// 5. Para PIX/boleto/débito Caixa o status volta `pending` e o frontend pollar
//    `GET /api/payments/:id/status` até webhook atualizar.

// Métodos abstratos que persistimos no banco (enum `payment_method`).
export const paymentMethodEnum = z.enum(['card', 'pix', 'boleto', 'debit_caixa']);
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

export const paymentStatusEnum = z.enum(['pending', 'approved', 'failed']);
export type PaymentStatus = z.infer<typeof paymentStatusEnum>;

// IDs do Mercado Pago para cada método (vão no body de `payment.create`).
//   - 'pix'           → PIX
//   - 'bolbradesco'   → Boleto bancário Bradesco (default da MP no Brasil)
//   - 'debvirtualcaixa' → Cartão de débito virtual Caixa
//   - cartões: 'visa', 'master', 'amex', 'elo', 'hipercard', etc. (vem do brick)
export type MpPaymentTypeId =
  | 'credit_card'
  | 'debit_card'
  | 'bank_transfer'
  | 'ticket';

// =============================================================================
// Request: cliente → backend
// =============================================================================

// Identificação do pagador (para Boleto/PIX é obrigatória pelo Mercado Pago).
export const payerIdentificationSchema = z.object({
  type: z.enum(['CPF', 'CNPJ']).default('CPF'),
  number: z
    .string()
    .min(11)
    .max(18)
    .transform((s) => s.replace(/\D+/g, '')),
});

export const createPaymentSchema = z.object({
  productId: z.string().uuid(),
  username: z.string().min(1).max(80),
  // Dados do pagador
  payerName: z.string().min(2).max(120),
  payerEmail: z.string().email().max(160),
  payerMessage: z.string().max(500).optional().default(''),
  payerIdentification: payerIdentificationSchema,

  // Dados vindos do Payment Brick (`formData`).
  // Para cartão: `token` + `installments` + `payment_method_id` + opcional `issuer_id`.
  // Para PIX/boleto/débito Caixa: apenas `payment_method_id` é relevante.
  token: z.string().optional(),
  installments: z.number().int().positive().default(1),
  // ID do método na MP (ex.: 'visa', 'pix', 'bolbradesco', 'debvirtualcaixa').
  mpPaymentMethodId: z.string().min(1),
  // Tipo do método na MP (vem direto do brick).
  mpPaymentTypeId: z
    .enum(['credit_card', 'debit_card', 'bank_transfer', 'ticket'])
    .optional(),
  issuerId: z.string().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// =============================================================================
// Response: backend → cliente
// =============================================================================

// Dados específicos do PIX (QR code para pagamento).
export interface PixPaymentInfo {
  qrCode: string; // string copia-e-cola (EMV)
  qrCodeBase64: string; // imagem PNG em base64 (sem prefixo data:)
  ticketUrl: string | null; // link para abrir no app do banco
  expiresAt: string | null;
}

// Dados específicos do Boleto.
export interface BoletoPaymentInfo {
  ticketUrl: string; // PDF do boleto / página HTML
  barcode: string | null;
  expiresAt: string | null;
}

// Dados específicos do débito virtual Caixa.
export interface DebitCaixaPaymentInfo {
  ticketUrl: string; // URL para o usuário concluir o pagamento no app Caixa
  expiresAt: string | null;
}

export interface CreatePaymentResult {
  paymentId: string; // ID do nosso registro local (uuid)
  mpPaymentId: string; // ID do pagamento na MP (string)
  status: PaymentStatus;
  statusDetail: string; // detalhe da MP (ex.: 'pending_waiting_payment')
  paymentMethod: PaymentMethod;
  amountCents: number;
  productName: string;
  pix?: PixPaymentInfo;
  boleto?: BoletoPaymentInfo;
  debitCaixa?: DebitCaixaPaymentInfo;
}

// =============================================================================
// Status polling (PIX / boleto / débito)
// =============================================================================

export interface PaymentStatusResult {
  status: PaymentStatus;
  statusDetail: string;
  paymentMethod: PaymentMethod | null;
}

// =============================================================================
// Listagens / dashboard (mantido)
// =============================================================================

export interface PaymentRecord {
  id: string;
  productId: string;
  productName: string;
  amountCents: number;
  status: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  payerName: string | null;
  payerEmail: string | null;
  payerMessage: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  totalReceivedCents: number;
  paymentCount: number;
  productCount: number;
  topProductName: string | null;
}

// =============================================================================
// Utilitários
// =============================================================================

// Mapeia `payment_method_id` + `payment_type_id` retornados pela MP no nosso
// enum local. Centraliza a regra de negócio em um só lugar.
export function detectPaymentMethod(input: {
  paymentMethodId?: string | null;
  paymentTypeId?: string | null;
}): PaymentMethod | null {
  const id = input.paymentMethodId?.toLowerCase() ?? '';
  const type = input.paymentTypeId?.toLowerCase() ?? '';
  if (id === 'pix' || type === 'bank_transfer') return 'pix';
  if (id === 'debvirtualcaixa') return 'debit_caixa';
  if (type === 'ticket' || id === 'bolbradesco' || id === 'pec') return 'boleto';
  if (type === 'credit_card' || type === 'debit_card') return 'card';
  return null;
}
