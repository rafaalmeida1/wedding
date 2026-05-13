import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { usernameSchema } from '@repo/shared/auth';
import { getPublicGift } from '@/lib/public-api';
import { formatBRL } from '@/lib/format';
import { GiftCheckout } from '@/components/payment/GiftCheckout';
import { FloralBackdrop } from '@/components/public/FloralBackdrop';

interface PageProps {
  params: { username: string; id: string };
}

export const dynamic = 'force-dynamic';

export default async function GiftPaymentPage({ params }: PageProps) {
  const slug = usernameSchema.safeParse(params.username);
  const idParsed = z.string().uuid().safeParse(params.id);
  if (!slug.success || !idParsed.success) notFound();
  const data = await getPublicGift(slug.data, idParsed.data);
  if (!data) notFound();
  const { couple, product } = data;

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-cream font-sans text-ink">
      <FloralBackdrop />
      <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6 sm:pb-14 sm:pt-8 lg:px-8 lg:pb-16 lg:pt-12">
        <Link
          href={`/${couple.username}`}
          className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full px-2 py-2 text-sm text-ink-mute transition hover:bg-white/60 hover:text-rose-700 active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Voltar para a lista</span>
        </Link>

        {/* Mobile-first: checkout primeiro; desktop: foto à esquerda */}
        <div className="mt-6 flex flex-col gap-8 lg:mt-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.12fr)] lg:items-start lg:gap-12 xl:gap-16">
          <section
            className="order-1 rounded-[1.75rem] border border-rose-100/90 bg-white/90 p-5 shadow-[0_12px_50px_-18px_rgba(194,24,91,0.22)] backdrop-blur-md sm:p-8 lg:order-2 lg:rounded-3xl lg:p-10"
            id="gift-checkout"
          >
            {product.isOutOfStock ? (
              <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-white px-4 py-10 text-center sm:px-8 sm:py-12">
                <p className="font-serif text-2xl text-ink sm:text-3xl">Esse presente foi escolhido!</p>
                <p className="mt-3 max-w-sm mx-auto text-sm leading-relaxed text-ink-mute sm:text-base">
                  Volte para a lista e veja os demais presentes disponíveis.
                </p>
                <Link
                  href={`/${couple.username}`}
                  className="btn-primary mt-8 min-h-12 w-full justify-center sm:w-auto"
                >
                  Ver outros presentes
                </Link>
              </div>
            ) : (
              <GiftCheckout
                username={couple.username}
                productId={product.id}
                productName={product.name}
                amountCents={product.priceCents}
              />
            )}
          </section>

          <aside className="order-2 space-y-5 sm:space-y-6 lg:sticky lg:top-8 lg:order-1 lg:self-start">
            <div className="overflow-hidden rounded-2xl bg-rose-50 shadow-bloom ring-1 ring-rose-100/80 sm:rounded-3xl">
              <Image
                src={product.imageUrl}
                alt={product.name}
                width={700}
                height={700}
                className="aspect-square w-full object-cover sm:aspect-[5/4] lg:aspect-square"
                sizes="(max-width: 1024px) 100vw, 42vw"
                priority
              />
            </div>
            <div className="px-0.5">
              <p className="label-eyebrow">Presente para</p>
              <h2 className="mt-1.5 font-serif text-2xl leading-tight text-ink sm:text-3xl lg:text-4xl">
                {couple.name}
              </h2>
            </div>
            <div className="rounded-2xl border border-rose-100/80 bg-white/50 px-4 py-5 sm:px-5 sm:py-6">
              <h1 className="font-serif text-xl leading-snug text-ink sm:text-2xl lg:text-3xl">
                {product.name}
              </h1>
              {product.description ? (
                <p className="mt-2 text-sm leading-relaxed text-ink-mute sm:text-base">{product.description}</p>
              ) : null}
              <p className="mt-4 font-serif text-2xl tabular-nums text-rose-600 sm:text-3xl">
                {formatBRL(product.priceCents)}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
