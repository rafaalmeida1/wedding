import { eq, payments } from '@repo/db';
import {
  detectPaymentMethod,
  type PaymentMethod,
} from '@repo/shared/payments';
import { paymentEventSchema } from '@repo/shared/events';
import { getDb } from '@/server/db';
import { jsonOk } from '@/server/http';
import { getMpPayment, verifyMpWebhook } from '@/server/mercadopago';
import { mapMpStatus } from '@/server/payments-map';
import { buildPaymentEvent, fulfillApprovedPayment } from '@/server/payment-fulfillment';

export const runtime = 'nodejs';

async function publishApproved(
  paymentId: string,
  productId: string,
  ownerUserId: string,
  amountCents: number,
  meta: {
    payerEmail: string | null;
    payerName: string | null;
    payerMessage: string | null;
    paymentMethod: PaymentMethod | null;
  },
) {
  const raw = buildPaymentEvent({
    paymentId,
    productId,
    ownerUserId,
    amountCents,
    payerEmail: meta.payerEmail,
    payerName: meta.payerName,
    payerMessage: meta.payerMessage,
    paymentMethod: meta.paymentMethod,
  });
  const event = paymentEventSchema.parse(raw);
  void fulfillApprovedPayment(event).catch((err) =>
    console.error('[webhook] fulfill failed', (err as Error).message),
  );
}

export async function POST(req: Request) {
  const signature = req.headers.get('x-signature');
  const requestId = req.headers.get('x-request-id');
  const raw = await req.text();
  let body: { action?: string; type?: string; data?: { id?: string | number } };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const dataId = body?.data?.id != null ? String(body.data.id) : '';
  if (!dataId) {
    return jsonOk({ received: true, ignored: 'missing data.id' });
  }

  const ok = verifyMpWebhook({
    signatureHeader: signature,
    requestIdHeader: requestId,
    dataId,
  });
  if (!ok) {
    return new Response(JSON.stringify({ error: 'invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isPayment = body.type === 'payment' || body.action?.startsWith('payment.');
  if (!isPayment) {
    return jsonOk({ received: true, ignored: `type=${body.type}` });
  }

  let mp;
  try {
    mp = await getMpPayment(dataId);
  } catch (err) {
    console.warn('[mp-webhook] payment fetch failed', (err as Error).message);
    return jsonOk({ received: true, deferred: true });
  }

  const status = mapMpStatus(mp.status);
  const method =
    detectPaymentMethod({
      paymentMethodId: mp.payment_method_id,
      paymentTypeId: mp.payment_type_id,
    }) ?? null;
  const md = mp.metadata ?? {};
  const productId =
    (md.product_id as string | undefined) ?? (md.productId as string | undefined) ?? null;
  const ownerUserId =
    (md.owner_user_id as string | undefined) ??
    (md.ownerUserId as string | undefined) ??
    null;

  const db = getDb();
  const [existing] = await db
    .select()
    .from(payments)
    .where(eq(payments.mpPaymentId, dataId))
    .limit(1);

  if (!existing) {
    if (!productId || !ownerUserId) {
      console.warn('[mp-webhook] cannot create payment without metadata', dataId);
      return jsonOk({ received: true, ignored: 'missing metadata' });
    }
    const [created] = await db
      .insert(payments)
      .values({
        productId,
        userId: ownerUserId,
        mpPaymentId: dataId,
        amountCents: Math.round((mp.transaction_amount ?? 0) * 100),
        status,
        payerEmail:
          (md.payer_email as string | undefined) ??
          (md.payerEmail as string | undefined) ??
          mp.payer?.email ??
          null,
        payerName:
          (md.payer_name as string | undefined) ??
          (md.payerName as string | undefined) ??
          null,
        payerMessage:
          (md.payer_message as string | undefined) ??
          (md.payerMessage as string | undefined) ??
          null,
        paymentMethod: method,
      })
      .returning();
    if (status === 'approved' && created) {
      await publishApproved(created.id, created.productId, created.userId, created.amountCents, {
        payerEmail: created.payerEmail,
        payerName: created.payerName,
        payerMessage: created.payerMessage,
        paymentMethod: created.paymentMethod ?? method,
      });
    }
    return jsonOk({ received: true, action: 'created', status });
  }

  if (existing.status === 'approved' && status !== 'approved') {
    return jsonOk({ received: true, ignored: 'already approved' });
  }
  if (existing.status === status) {
    return jsonOk({ received: true, ignored: 'no transition' });
  }
  await db
    .update(payments)
    .set({ status, paymentMethod: method ?? existing.paymentMethod, updatedAt: new Date() })
    .where(eq(payments.id, existing.id));

  if (status === 'approved' && existing.status !== 'approved') {
    await publishApproved(
      existing.id,
      existing.productId,
      existing.userId,
      existing.amountCents,
      {
        payerEmail: existing.payerEmail,
        payerName: existing.payerName,
        payerMessage: existing.payerMessage,
        paymentMethod: method ?? existing.paymentMethod,
      },
    );
  }

  return jsonOk({ received: true, action: 'updated', status });
}
