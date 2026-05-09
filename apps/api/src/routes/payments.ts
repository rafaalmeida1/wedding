import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, desc, eq, payments, products, users } from '@repo/db';
import {
  createPaymentSchema,
  detectPaymentMethod,
  type CreatePaymentResult,
  type PaymentRecord,
  type PaymentStatus,
  type PaymentStatusResult,
} from '@repo/shared/payments';
import { db } from '../services/db.js';
import { requireAuth, type AuthContext } from '../middleware/auth.js';
import {
  createMpPayment,
  getMpPayment,
  type MpPaymentResponse,
} from '../services/mercadopago.js';
import { publishPaymentEvent } from '../kafka/producer.js';

// =============================================================================
// /api/payments
// =============================================================================
//
// POST /                 → cria um pagamento no Mercado Pago (público)
// GET  /:id/status       → checa status de um pagamento (público, polling)
// GET  /                 → lista pagamentos aprovados do usuário logado (dashboard)

const app = new Hono<AuthContext>();

// -----------------------------------------------------------------------------
// POST /api/payments — checkout transparente
// -----------------------------------------------------------------------------
app.post('/', zValidator('json', createPaymentSchema), async (c) => {
  const input = c.req.valid('json');

  // 1. Carrega o produto + dono pela combinação username+productId. Validamos
  //    aqui (no servidor) o preço de verdade — nunca confiamos em valor vindo
  //    do cliente.
  const [row] = await db
    .select({
      product: products,
      owner: { id: users.id, name: users.name, email: users.email, username: users.username },
    })
    .from(products)
    .innerJoin(users, eq(products.userId, users.id))
    .where(and(eq(users.username, input.username), eq(products.id, input.productId)))
    .limit(1);
  if (!row) throw new HTTPException(404, { message: 'presente não encontrado' });
  if (row.product.stock <= 0) {
    throw new HTTPException(409, { message: 'presente esgotado' });
  }

  // 2. Idempotency-Key: usamos o e-mail + product + timestamp grosso para evitar
  //    duplicidades caso o usuário clique duas vezes.
  const idempotencyKey = `${input.payerEmail}:${input.productId}:${Math.floor(Date.now() / 5000)}`;

  // 3. Cria o pagamento na Mercado Pago.
  let mp: MpPaymentResponse;
  try {
    mp = await createMpPayment({
      amountCents: row.product.priceCents,
      description: `Presente: ${row.product.name}`,
      payerEmail: input.payerEmail,
      payerName: input.payerName,
      payerCpf: input.payerIdentification.number,
      payerCpfType: input.payerIdentification.type,
      token: input.token,
      installments: input.installments,
      paymentMethodId: input.mpPaymentMethodId,
      paymentTypeId: input.mpPaymentTypeId,
      issuerId: input.issuerId,
      idempotencyKey,
      metadata: {
        product_id: row.product.id,
        product_name: row.product.name,
        owner_user_id: row.owner.id,
        owner_username: row.owner.username,
        payer_name: input.payerName,
        payer_email: input.payerEmail,
        payer_message: input.payerMessage ?? '',
      },
    });
  } catch (err) {
    console.error('[mp] createPayment failed', err);
    const message = (err as Error).message ?? 'falha ao criar pagamento';
    throw new HTTPException(502, { message });
  }

  // 4. Mapeia o status MP → nosso enum interno.
  const localStatus = mapMpStatus(mp.status);
  const localMethod =
    detectPaymentMethod({
      paymentMethodId: mp.payment_method_id,
      paymentTypeId: mp.payment_type_id,
    }) ?? 'card';

  // 5. Persiste no banco (idempotente: se já existir o mp_payment_id, atualiza).
  const mpId = String(mp.id);
  const [existing] = await db
    .select()
    .from(payments)
    .where(eq(payments.mpPaymentId, mpId))
    .limit(1);

  let dbId: string;
  if (existing) {
    dbId = existing.id;
    await db
      .update(payments)
      .set({ status: localStatus, paymentMethod: localMethod, updatedAt: new Date() })
      .where(eq(payments.id, existing.id));
  } else {
    const [created] = await db
      .insert(payments)
      .values({
        productId: row.product.id,
        userId: row.owner.id,
        mpPaymentId: mpId,
        amountCents: row.product.priceCents,
        status: localStatus,
        payerEmail: input.payerEmail,
        payerName: input.payerName,
        payerMessage: input.payerMessage || null,
        paymentMethod: localMethod,
      })
      .returning();
    if (!created) throw new HTTPException(500, { message: 'falha ao registrar pagamento' });
    dbId = created.id;
  }

  // 6. Se já veio aprovado (cartão), dispara o evento Kafka imediatamente.
  if (localStatus === 'approved' && !existing) {
    await publishPaymentEvent({
      paymentId: dbId,
      productId: row.product.id,
      ownerUserId: row.owner.id,
      amountCents: row.product.priceCents,
      payerEmail: input.payerEmail,
      payerName: input.payerName,
      payerMessage: input.payerMessage || null,
      paymentMethod: localMethod,
      occurredAt: new Date().toISOString(),
    });
  }

  // 7. Monta a resposta com os dados específicos do método.
  const result: CreatePaymentResult = {
    paymentId: dbId,
    mpPaymentId: mpId,
    status: localStatus,
    statusDetail: mp.status_detail,
    paymentMethod: localMethod,
    amountCents: row.product.priceCents,
    productName: row.product.name,
  };

  if (localMethod === 'pix') {
    const data = mp.point_of_interaction?.transaction_data;
    if (data?.qr_code && data?.qr_code_base64) {
      result.pix = {
        qrCode: data.qr_code,
        qrCodeBase64: data.qr_code_base64,
        ticketUrl: data.ticket_url ?? null,
        expiresAt: mp.date_of_expiration ?? null,
      };
    }
  } else if (localMethod === 'boleto') {
    const ticket =
      mp.transaction_details?.external_resource_url ??
      mp.point_of_interaction?.transaction_data?.ticket_url;
    if (ticket) {
      result.boleto = {
        ticketUrl: ticket,
        barcode: mp.barcode?.content ?? null,
        expiresAt: mp.date_of_expiration ?? null,
      };
    }
  } else if (localMethod === 'debit_caixa') {
    const ticket =
      mp.transaction_details?.external_resource_url ??
      mp.point_of_interaction?.transaction_data?.ticket_url;
    if (ticket) {
      result.debitCaixa = {
        ticketUrl: ticket,
        expiresAt: mp.date_of_expiration ?? null,
      };
    }
  }

  return c.json(result, 201);
});

// -----------------------------------------------------------------------------
// GET /api/payments/:id/status — usado pelo cliente para pollar PIX/boleto/débito
// -----------------------------------------------------------------------------
app.get('/:id/status', zValidator('param', z.object({ id: z.string().uuid() })), async (c) => {
  const { id } = c.req.valid('param');
  const [row] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  if (!row) throw new HTTPException(404, { message: 'pagamento não encontrado' });

  // Se ainda está pending, consulta a MP em tempo real para uma resposta atualizada.
  // Webhooks podem demorar e o usuário está esperando — confirmar via API é barato.
  let status: PaymentStatus = row.status;
  let statusDetail = '';
  if (row.status === 'pending') {
    try {
      const mp = await getMpPayment(row.mpPaymentId);
      status = mapMpStatus(mp.status);
      statusDetail = mp.status_detail;
      // Se a consulta confirmou aprovação e o webhook ainda não chegou, atualizamos
      // o registro local e disparamos o evento Kafka aqui mesmo (idempotente).
      // (row.status já é 'pending' aqui — o guard externo garante isso.)
      if (status === 'approved') {
        await db
          .update(payments)
          .set({ status, updatedAt: new Date() })
          .where(eq(payments.id, row.id));
        await publishPaymentEvent({
          paymentId: row.id,
          productId: row.productId,
          ownerUserId: row.userId,
          amountCents: row.amountCents,
          payerEmail: row.payerEmail,
          payerName: row.payerName,
          payerMessage: row.payerMessage,
          paymentMethod: row.paymentMethod ?? 'card',
          occurredAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('[mp] status fetch failed', (err as Error).message);
    }
  }

  const result: PaymentStatusResult = {
    status,
    statusDetail,
    paymentMethod: row.paymentMethod,
  };
  return c.json(result);
});

// -----------------------------------------------------------------------------
// GET /api/payments — dashboard (rotas privadas abaixo)
// -----------------------------------------------------------------------------
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

app.get('/', requireAuth, zValidator('query', listQuery), async (c) => {
  const auth = c.get('user');
  const { limit, offset } = c.req.valid('query');
  const rows = await db
    .select({
      id: payments.id,
      productId: payments.productId,
      productName: products.name,
      amountCents: payments.amountCents,
      status: payments.status,
      paymentMethod: payments.paymentMethod,
      payerName: payments.payerName,
      payerEmail: payments.payerEmail,
      payerMessage: payments.payerMessage,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .innerJoin(products, eq(payments.productId, products.id))
    .where(and(eq(payments.userId, auth.sub), eq(payments.status, 'approved')))
    .orderBy(desc(payments.createdAt))
    .limit(limit)
    .offset(offset);

  const list: PaymentRecord[] = rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.productName,
    amountCents: r.amountCents,
    status: r.status,
    paymentMethod: r.paymentMethod,
    payerName: r.payerName,
    payerEmail: r.payerEmail,
    payerMessage: r.payerMessage,
    createdAt: r.createdAt.toISOString(),
  }));
  return c.json({ payments: list });
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function mapMpStatus(s: MpPaymentResponse['status']): PaymentStatus {
  switch (s) {
    case 'approved':
    case 'authorized':
      return 'approved';
    case 'pending':
    case 'in_process':
      return 'pending';
    default:
      return 'failed';
  }
}

export default app;
