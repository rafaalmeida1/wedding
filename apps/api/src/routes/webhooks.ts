import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { eq, payments } from '@repo/db';
import { detectPaymentMethod, type PaymentMethod, type PaymentStatus } from '@repo/shared/payments';
import { db } from '../services/db.js';
import { getMpPayment, verifyMpWebhook } from '../services/mercadopago.js';
import { publishPaymentEvent } from '../rabbitmq/publisher.js';
import { mapMpStatus } from './payments.js';

// =============================================================================
// Mercado Pago — Webhook (Notifications)
// =============================================================================
//
// Configurar em: https://www.mercadopago.com.br/developers/panel/notifications/webhooks
// URL: https://<seu-dominio>/api/webhooks/mercadopago
// Eventos: "Pagamentos" (payment.created, payment.updated)
//
// O body típico é:
//   { action: "payment.updated", type: "payment", data: { id: "12345" } }
//
// A MP envia headers `x-signature` e `x-request-id`. Validamos `x-signature`
// usando a secret configurada no painel (campo "Secret signature").
//
// Em dev, sem `MP_WEBHOOK_SECRET` definido, aceitamos qualquer payload — útil
// para testar com o "Simular notificação" do painel.

const app = new Hono();

app.post('/mercadopago', async (c) => {
  const signature = c.req.header('x-signature');
  const requestId = c.req.header('x-request-id');

  // Body pode vir como JSON ou form-urlencoded. Lemos cru e parseamos.
  const raw = await c.req.text();
  let body: { action?: string; type?: string; data?: { id?: string | number } };
  try {
    body = JSON.parse(raw);
  } catch {
    throw new HTTPException(400, { message: 'invalid json' });
  }

  const dataId = body?.data?.id != null ? String(body.data.id) : '';
  if (!dataId) {
    // MP às vezes envia notificações de outras topics (merchant_order, etc.)
    // que não interessam para nós. Respondemos 200 para não causar retry.
    return c.json({ received: true, ignored: 'missing data.id' });
  }

  const ok = verifyMpWebhook({
    signatureHeader: signature,
    requestIdHeader: requestId,
    dataId,
  });
  if (!ok) {
    console.warn('[mp-webhook] invalid signature', { dataId, requestId });
    throw new HTTPException(401, { message: 'invalid signature' });
  }

  // Ignoramos tipos que não são pagamento (merchant_order, plan, subscription, etc.).
  const isPayment = body.type === 'payment' || body.action?.startsWith('payment.');
  if (!isPayment) {
    return c.json({ received: true, ignored: `type=${body.type}` });
  }

  // Buscamos o pagamento na MP para obter o estado canônico (não confiamos no body).
  let mp;
  try {
    mp = await getMpPayment(dataId);
  } catch (err) {
    console.warn('[mp-webhook] payment fetch failed', (err as Error).message);
    // Retornamos 200 — a MP pode estar tentando notificar antes do payment estar
    // 100% propagado. Se realmente sumiu, próximas tentativas também falharão e
    // a notificação cessará.
    return c.json({ received: true, deferred: true });
  }

  const status = mapMpStatus(mp.status);
  const method =
    detectPaymentMethod({
      paymentMethodId: mp.payment_method_id,
      paymentTypeId: mp.payment_type_id,
    }) ?? null;
  // ATENÇÃO: a Mercado Pago às vezes converte chaves de metadata snake_case
  // para camelCase no response. Lemos os dois para ficar seguro.
  const md = mp.metadata ?? {};
  const productId =
    (md.product_id as string | undefined) ?? (md.productId as string | undefined) ?? null;
  const ownerUserId =
    (md.owner_user_id as string | undefined) ??
    (md.ownerUserId as string | undefined) ??
    null;

  // Idempotência: pode já existir por POST /api/payments ter persistido antes.
  const [existing] = await db
    .select()
    .from(payments)
    .where(eq(payments.mpPaymentId, dataId))
    .limit(1);

  if (!existing) {
    if (!productId || !ownerUserId) {
      console.warn('[mp-webhook] cannot create payment without metadata', dataId);
      return c.json({ received: true, ignored: 'missing metadata' });
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
    return c.json({ received: true, action: 'created', status });
  }

  // Já temos: aplicamos transição de estado idempotente.
  //   pending  → approved/failed: aceita e dispara evento
  //   approved → qualquer:        ignora (já processado)
  //   failed   → approved:        aceita (cancelamento/reprocessamento)
  if (existing.status === 'approved' && status !== 'approved') {
    return c.json({ received: true, ignored: 'already approved' });
  }
  if (existing.status === status) {
    return c.json({ received: true, ignored: 'no transition' });
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

  return c.json({ received: true, action: 'updated', status });
});

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
  await publishPaymentEvent({
    paymentId,
    productId,
    ownerUserId,
    amountCents,
    payerEmail: meta.payerEmail,
    payerName: meta.payerName,
    payerMessage: meta.payerMessage,
    paymentMethod: meta.paymentMethod,
    occurredAt: new Date().toISOString(),
  });
}

// Mantemos referência para evitar tree-shake de tipos não usados aqui.
void (null as unknown as PaymentStatus);

export default app;
