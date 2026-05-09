import { listPayments } from '@/actions/dashboard';
import { formatBRL, formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const payments = await listPayments();
  return (
    <div className="space-y-8">
      <header>
        <p className="label-eyebrow">Histórico</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">Pagamentos recebidos</h1>
      </header>

      {payments.length === 0 ? (
        <div className="card-soft text-center text-ink-mute">
          Ainda não há pagamentos confirmados.
        </div>
      ) : (
        <div className="card-soft overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-rose-100 text-xs uppercase tracking-wider text-ink-mute">
                <th className="pb-3">Data</th>
                <th className="pb-3">Presente</th>
                <th className="pb-3">Convidado</th>
                <th className="pb-3">Método</th>
                <th className="pb-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-rose-50/70 last:border-0">
                  <td className="py-3 text-ink-mute">{formatDateTime(p.createdAt)}</td>
                  <td className="py-3 font-medium text-ink">{p.productName}</td>
                  <td className="py-3">
                    <div>
                      <p className="text-ink">{p.payerName ?? 'Anônimo'}</p>
                      {p.payerMessage ? (
                        <p className="text-xs italic text-ink-mute line-clamp-1">
                          “{p.payerMessage}”
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 capitalize text-ink-mute">
                    {p.paymentMethod ?? '—'}
                  </td>
                  <td className="py-3 text-right font-medium text-rose-600">
                    {formatBRL(p.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
