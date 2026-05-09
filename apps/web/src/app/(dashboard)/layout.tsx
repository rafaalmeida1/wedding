import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Heart, LayoutDashboard, Package, ReceiptText, Settings } from 'lucide-react';
import { getCurrentUser, logoutAction } from '@/actions/auth';

const NAV = [
  { href: '/dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { href: '/dashboard/products', label: 'Produtos', icon: Package },
  { href: '/dashboard/payments', label: 'Pagamentos', icon: ReceiptText },
  { href: '/dashboard/settings', label: 'Conta', icon: Settings },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-rose-100 bg-white/70 px-6 py-8 backdrop-blur md:flex">
          <Link href="/" className="flex items-center gap-2 font-serif text-xl text-ink">
            <Heart className="h-5 w-5 text-rose-600" />
            Lista de Presentes
          </Link>
          <nav className="mt-10 flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-soft transition hover:bg-rose-50 hover:text-rose-700"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
            <p className="text-xs text-ink-mute">Logado como</p>
            <p className="truncate text-sm font-medium text-ink">{user.name}</p>
            <p className="truncate text-xs text-ink-mute">{user.email}</p>
            <form action={logoutAction} className="mt-3">
              <button
                type="submit"
                className="text-xs text-rose-700 hover:underline"
              >
                Sair
              </button>
            </form>
          </div>
        </aside>
        <main className="flex-1 px-6 py-10 md:px-10">{children}</main>
      </div>
    </div>
  );
}
