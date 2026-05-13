import { eq, payments } from '@repo/db';
import type { PaymentStatus } from '@repo/shared/payments';
import { getDb } from '@/server/db';
import { jsonErr, jsonOk } from '@/server/http';
import { getMpPayment } from '@/server/mercadopago';
import { mapMpStatus } from '@/server/payments-map';
import { buildPaymentEvent, fulfillApprovedPayment } from '@/server/payment-fulfillment';
import { rateLimitOrNull } from '@/server/rate-limit';
import { z } from 'zod';

export const runtime = 'nodejs';

const idParam = z.object({ id: z.string().uuid() });

type Ctx = { params: { id: string } };

export async function GET(req: Request, { params }: Ctx) {
  const parsed = idParam.safeParse({ id: params.id });
  if (!parsed.success) return jsonErr('invalid id', 400);

  const limited = await rateLimitOrNull(req, '/api/payments/status', 120, 60);
  if (limited) return limited;

  const { id } = parsed.data;
  const db = getDb();
  const [row] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
  if (!row) return jsonErr('pagamento não encontrado', 404);

  let status: PaymentStatus = row.status;
  let statusDetail = '';
  if (row.status === 'pending') {
    try {
      const mp = await getMpPayment(row.mpPaymentId);
      status = mapMpStatus(mp.status);
      statusDetail = mp.status_detail;
      if (status === 'approved') {
        await db
          .update(payments)
          .set({ status, updatedAt: new Date() })
          .where(eq(payments.id, row.id));
        const ev = buildPaymentEvent({
          paymentId: row.id,
          productId: row.productId,
          ownerUserId: row.userId,
          amountCents: row.amountCents,
          payerEmail: row.payerEmail,
          payerName: row.payerName,
          payerMessage: row.payerMessage,
          paymentMethod: row.paymentMethod ?? 'card',
        });
        await fulfillApprovedPayment(ev);
      }
    } catch (err) {
      console.warn('[mp] status fetch failed', (err as Error).message);
    }
  }

  return jsonOk({
    status,
    statusDetail,
    paymentMethod: row.paymentMethod,
  });
}
