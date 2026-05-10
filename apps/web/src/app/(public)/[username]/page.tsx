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

  return (
    <main className="relative min-h-screen overflow-hidden bg-cream">
      <FloralBackdrop />
      <div className="relative mx-auto max-w-6xl px-6 py-16">
        <header className="text-center">
          <p className="label-eyebrow flex items-center justify-center gap-2">
            <Sparkles className="h-3.5 w-3.5" /> Lista de Casamento
          </p>
          <h1 className="mt-4 font-serif text-5xl text-ink md:text-6xl">{couple.name}</h1>
          <p className="mx-auto mt-4 max-w-md text-ink-mute">
            Sua presença é nosso maior presente. Mas se quiser nos brindar com algo,
            escolha um item da lista — pagamento direto pelo site, com cartão ou PIX.
          </p>
        </header>

        {products.length === 0 ? (
          <p className="mt-16 text-center text-ink-mute">
            A lista ainda está sendo preparada. Volte em breve!
          </p>
        ) : (
          <ul className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => (
              <li
                key={p.id}
                className="group card-soft flex flex-col gap-4 transition hover:-translate-y-1 hover:shadow-bloom"
              >
                <div className="aspect-square overflow-hidden rounded-2xl bg-rose-50">
                  <Image
                    src={p.imageUrl}
                    alt={p.name}
                    width={500}
                    height={500}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div>
                  <h3 className="font-serif text-2xl text-ink">{p.name}</h3>
                  {p.description ? (
                    <p className="mt-1 text-sm text-ink-mute line-clamp-2">{p.description}</p>
                  ) : null}
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <span className="font-serif text-2xl text-rose-600">
                    {formatBRL(p.priceCents)}
                  </span>
                  {p.isOutOfStock ? (
                    <span className="rounded-full bg-ink-mute/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">
                      Esgotado
                    </span>
                  ) : (
                    <Link
                      href={`/${couple.username}/gift/${p.id}`}
                      className="btn-primary !py-2 !px-5"
                    >
                      <Heart className="h-4 w-4" /> Presentear
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <footer className="mt-24 text-center text-xs text-ink-mute">
          <p>✦ ✦ ✦</p>
        </footer>
      </div>
    </main>
  );
}
