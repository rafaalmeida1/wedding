import { and, desc, eq, payments, products, users } from '@repo/db';
import {
  createPaymentSchema,
  detectPaymentMethod,
  type CreatePaymentResult,
  type PaymentMethod,
  type PaymentRecord,
} from '@repo/shared/payments';
import { getDb } from '@/server/db';
import { jsonErr, jsonOk } from '@/server/http';
import { createMpPayment, getMpPayment, type MpPaymentResponse } from '@/server/mercadopago';
import { mapMpStatus } from '@/server/payments-map';
import { buildPaymentEvent, fulfillApprovedPayment } from '@/server/payment-fulfillment';
import { rateLimitOrNull } from '@/server/rate-limit';
import { getSessionUser } from '@/server/session';
import { z } from 'zod';

export const runtime = 'nodejs';

async function runApprovedSideEffects(args: {
  paymentId: string;
  productId: string;
  ownerUserId: string;
  amountCents: number;
  payerEmail: string | null;
  payerName: string | null;
  payerMessage: string | null;
  paymentMethod: PaymentMethod | null;
}) {
  const ev = buildPaymentEvent({
    paymentId: args.paymentId,
    productId: args.productId,
    ownerUserId: args.ownerUserId,
    amountCents: args.amountCents,
    payerEmail: args.payerEmail,
    payerName: args.payerName,
    payerMessage: args.payerMessage,
    paymentMethod: args.paymentMethod ?? null,
  });
  await fulfillApprovedPayment(ev);
}

export async function POST(req: Request) {
  const limited = await rateLimitOrNull(req, '/api/payments', 30, 60);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr('invalid json', 400);
  }
  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr('validação falhou', 400);
  }
  const input = parsed.data;

  const db = getDb();
  const [row] = await db
    .select({
      product: products,
      owner: { id: users.id, name: users.name, email: users.email, username: users.username },
    })
    .from(products)
    .innerJoin(users, eq(products.userId, users.id))
    .where(and(eq(users.username, input.username), eq(products.id, input.productId)))
    .limit(1);
  if (!row) return jsonErr('presente não encontrado', 404);
  if (row.product.stock <= 0) {
    return jsonErr('presente esgotado', 409);
  }

  const idempotencyKey = `${input.payerEmail}:${input.productId}:${Math.floor(Date.now() / 5000)}`;

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
    return jsonErr(message, 502);
  }

  const localStatus = mapMpStatus(mp.status);
  const localMethod =
    detectPaymentMethod({
      paymentMethodId: mp.payment_method_id,
      paymentTypeId: mp.payment_type_id,
    }) ?? 'card';

  const mpId = String(mp.id);
  const [existing] = await db.select().from(payments).where(eq(payments.mpPaymentId, mpId)).limit(1);

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
    if (!created) return jsonErr('falha ao registrar pagamento', 500);
    dbId = created.id;
  }

  if (localStatus === 'approved' && !existing) {
    await runApprovedSideEffects({
      paymentId: dbId,
      productId: row.product.id,
      ownerUserId: row.owner.id,
      amountCents: row.product.priceCents,
      payerEmail: input.payerEmail,
      payerName: input.payerName,
      payerMessage: input.payerMessage || null,
      paymentMethod: localMethod,
    });
  }

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

  return jsonOk(result, { status: 201 });
}

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: Request) {
  const limited = await rateLimitOrNull(req, '/api/payments', 30, 60);
  if (limited) return limited;
  const auth = await getSessionUser();
  if (!auth) return jsonErr('unauthenticated', 401);

  const url = new URL(req.url);
  const parsed = listQuery.safeParse({
    limit: url.searchParams.get('limit') ?? undefined,
    offset: url.searchParams.get('offset') ?? undefined,
  });
  if (!parsed.success) {
    return jsonErr('query inválida', 400);
  }
  const { limit, offset } = parsed.data;

  const db = getDb();
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
  return jsonOk({ payments: list });
}
