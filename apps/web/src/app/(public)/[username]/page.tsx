import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Heart, Sparkles } from 'lucide-react';
import { usernameSchema } from '@repo/shared/auth';
import { getPublicList } from '@/lib/public-api';
import { formatBRL } from '@/lib/format';
import { FloralBackdrop } from '@/components/public/FloralBackdrop';

interface PageProps {
  params: { username: string };
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps) {
  const slug = usernameSchema.safeParse(params.username);
  if (!slug.success) return { title: 'Lista não encontrada' };
  const data = await getPublicList(slug.data);
  if (!data) return { title: 'Lista não encontrada' };
  return {
    title: `Lista de Presentes — ${data.couple.name}`,
    description: `Presenteie ${data.couple.name} no grande dia.`,
  };
}

export default async function PublicListPage({ params }: PageProps) {
  const slug = usernameSchema.safeParse(params.username);
  if (!slug.success) notFound();
  const data = await getPublicList(slug.data);
  if (!data) notFound();
  const { couple, products } = data;
  const count = products.length;

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-cream font-sans text-ink">
      <FloralBackdrop />
      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pb-24 sm:pt-14 lg:px-10">
        <header className="mx-auto max-w-2xl text-center">
          <p className="label-eyebrow flex items-center justify-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} />
            Lista de casamento
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-ink sm:text-5xl lg:text-6xl">
            {couple.name}
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-ink-mute sm:mt-6 sm:text-lg">
            Sua presença já é um presente. Se quiser nos mimar com algo da lista, o pagamento é por
            aqui — cartão ou PIX, com segurança.
          </p>
        </header>

        {count === 0 ? (
          <div className="mx-auto mt-16 max-w-md rounded-3xl border border-rose-100/90 bg-white/85 px-8 py-14 text-center shadow-soft backdrop-blur-sm sm:mt-20 sm:py-16">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
              <Sparkles className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <p className="mt-5 font-serif text-xl text-ink sm:text-2xl">Lista em preparação</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-mute sm:text-base">
              Em breve os presentes aparecem por aqui. Volte mais tarde!
            </p>
          </div>
        ) : (
          <>
            <p className="mt-12 text-center text-sm font-medium text-ink-mute sm:mt-16">
              <span className="tabular-nums text-ink">{count}</span>{' '}
              {count === 1 ? 'presente na lista' : 'presentes na lista'}
            </p>
            <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:mt-8 lg:grid-cols-3 lg:gap-8">
              {products.map((p) => (
                <li key={p.id}>
                  <article className="group/card flex h-full flex-col overflow-hidden rounded-3xl border border-rose-100/90 bg-white/90 shadow-soft backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-rose-200/90 hover:shadow-bloom">
                    <Link
                      href={`/${couple.username}/gift/${p.id}`}
                      className="relative block aspect-[5/6] overflow-hidden bg-rose-50 sm:aspect-[4/5]"
                    >
                      <Image
                        src={p.imageUrl}
                        alt=""
                        fill
                        className="object-cover transition duration-500 ease-out group-hover/card:scale-[1.03]"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                      <span className="sr-only">Ver presente: {p.name}</span>
                      {p.isOutOfStock ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-ink/45 backdrop-blur-[2px]">
                          <span className="rounded-full bg-white/95 px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink shadow-sm">
                            Esgotado
                          </span>
                        </div>
                      ) : null}
                    </Link>
                    <div className="flex flex-1 flex-col p-5 sm:p-6">
                      <Link
                        href={`/${couple.username}/gift/${p.id}`}
                        className="block outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 rounded-md"
                      >
                        <h2 className="font-serif text-xl leading-snug text-ink transition group-hover/card:text-rose-700 sm:text-[1.35rem]">
                          {p.name}
                        </h2>
                      </Link>
                      {p.description ? (
                        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-mute">
                          {p.description}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-ink-mute/70">Toque para ver detalhes.</p>
                      )}
                      <div className="mt-auto flex flex-col gap-4 border-t border-rose-100/80 pt-5 sm:flex-row sm:items-end sm:justify-between">
                        <p className="font-serif text-2xl tabular-nums text-rose-600 sm:text-[1.65rem]">
                          {formatBRL(p.priceCents)}
                        </p>
                        {p.isOutOfStock ? (
                          <span className="inline-flex min-h-12 items-center justify-center rounded-full border border-rose-200/80 bg-rose-50/80 px-5 text-xs font-semibold uppercase tracking-wider text-ink-mute">
                            Indisponível
                          </span>
                        ) : (
                          <Link
                            href={`/${couple.username}/gift/${p.id}`}
                            className="btn-primary w-full min-h-12 justify-center px-6 text-[15px] shadow-[0_10px_32px_-14px_rgba(194,24,91,0.45)] sm:w-auto"
                          >
                            <Heart className="h-4 w-4 shrink-0" /> Presentear
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}

        <footer className="mt-20 border-t border-rose-100/60 pt-10 text-center sm:mt-24">
          <p className="text-xs tracking-[0.25em] text-ink-mute">✦ ✦ ✦</p>
        </footer>
      </div>
    </main>
  );
}
