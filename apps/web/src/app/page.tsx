import Link from 'next/link';
import { Heart, Sparkles, Wallet } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-cream">
      <div className="pointer-events-none absolute inset-0 bg-rose-gold-gradient opacity-20" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-16">
        <header className="flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl font-medium text-ink">
            ✦ Lista de Presentes
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-ink-soft hover:text-rose-600">
              Entrar
            </Link>
            <Link href="/register" className="btn-primary !py-2">
              Criar lista
            </Link>
          </nav>
        </header>

        <section className="mt-24 grid gap-12 md:grid-cols-2 md:items-center">
          <div className="animate-fade-in-up">
            <p className="label-eyebrow">Sua lista, seu jeito</p>
            <h1 className="mt-4 font-serif text-5xl leading-tight text-ink md:text-6xl">
              Crie sua lista de
              <span className="block text-rose-600">presentes de casamento</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-ink-mute">
              Os convidados presenteiam vocês direto pelo site, com cartão ou PIX.
              O dinheiro cai na sua conta — sem cupons, sem créditos, sem fricção.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="btn-primary">
                Começar grátis
              </Link>
              <Link href="/login" className="btn-ghost">
                Já tenho conta
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            {[
              {
                icon: <Sparkles className="h-5 w-5" />,
                title: 'Design feito para casais',
                copy: 'Tema rose gold, animações suaves, e responsivo no mobile.',
              },
              {
                icon: <Wallet className="h-5 w-5" />,
                title: 'Pagamento embutido',
                copy: 'Stripe Elements com cartão ou PIX. Sem redirecionamento.',
              },
              {
                icon: <Heart className="h-5 w-5" />,
                title: 'Mensagem dos convidados',
                copy: 'Cada presente vira um recado guardado no seu painel.',
              },
            ].map((feat) => (
              <div key={feat.title} className="card-soft flex items-start gap-4">
                <span className="mt-1 grid h-9 w-9 place-items-center rounded-full bg-rose-100 text-rose-600">
                  {feat.icon}
                </span>
                <div>
                  <h3 className="font-medium text-ink">{feat.title}</h3>
                  <p className="text-sm text-ink-mute">{feat.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-auto pt-24 text-center text-xs text-ink-mute">
          <p>✦ ✦ ✦</p>
          <p className="mt-2">
            Projeto inspirado em casar.com — pagamento Stripe + Framer Motion + Hono.
          </p>
        </footer>
      </div>
    </main>
  );
}
