import Link from 'next/link';
import { ArrowRight, ReceiptText, Package, Heart } from 'lucide-react';
import { getCurrentUser } from '@/actions/auth';
import { getSummary, listPayments } from '@/actions/dashboard';
import { formatBRL, formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DashboardHomePage() {
  const [user, summary, payments] = await Promise.all([
    getCurrentUser(),
    getSummary(),
    listPayments(),
  ]);
  const recent = payments.slice(0, 5);

  return (
    <div className="space-y-10">
      <header>
        <p className="label-eyebrow">Painel</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">Olá, {user?.name}</h1>
        <p className="mt-2 text-ink-mute">
          Sua URL pública:{' '}
          <Link
            href={`/${user?.username}`}
            className="font-medium text-rose-600 hover:underline"
          >
            {process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/{user?.username}
          </Link>
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={<Heart className="h-4 w-4" />}
          label="Total recebido"
          value={formatBRL(summary.totalReceivedCents)}
          hint={`${summary.paymentCount} presente${summary.paymentCount === 1 ? '' : 's'}`}
        />
        <SummaryCard
          icon={<Package className="h-4 w-4" />}
          label="Produtos cadastrados"
          value={String(summary.productCount)}
          hint={summary.topProductName ? `Mais querido: ${summary.topProductName}` : 'Nenhum ainda'}
        />
        <SummaryCard
          icon={<ReceiptText className="h-4 w-4" />}
          label="Mais escolhido"
          value={summary.topProductName ?? '—'}
          hint="Atualiza com cada pagamento"
        />
      </section>

      <section className="card-soft">
        <header className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-ink">Pagamentos recentes</h2>
          <Link
            href="/dashboard/payments"
            className="text-sm text-rose-600 hover:underline"
          >
            Ver todos
          </Link>
        </header>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-ink-mute">Nenhum pagamento ainda.</p>
        ) : (
          <ul className="mt-4 divide-y divide-rose-100">
            {recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-ink">{p.productName}</p>
                  <p className="text-xs text-ink-mute">
                    {p.payerName ?? 'Anônimo'} · {formatDateTime(p.createdAt)}
                  </p>
                </div>
                <p className="font-medium text-rose-600">{formatBRL(p.amountCents)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-soft flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-ink">Próximo passo</h2>
          <p className="mt-1 text-sm text-ink-mute">
            Cadastre seus presentes para enviar a lista aos convidados.
          </p>
        </div>
        <Link href="/dashboard/products/new" className="btn-primary">
          Cadastrar presente <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card-soft">
      <p className="label-eyebrow flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-rose-100 text-rose-600">
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-2 truncate font-serif text-2xl text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-mute">{hint}</p>
    </div>
  );
}
