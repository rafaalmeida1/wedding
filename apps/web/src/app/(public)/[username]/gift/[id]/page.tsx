import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
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
      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6 sm:pb-20 sm:pt-8 lg:px-10 lg:pb-24">
        <nav
          aria-label="Navegação secundária"
          className="flex flex-wrap items-center gap-1 text-sm text-ink-mute"
        >
          <Link
            href={`/${couple.username}`}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full py-1.5 pl-1 pr-3 transition hover:bg-white/70 hover:text-rose-700"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="max-w-[10rem] truncate sm:max-w-none">Lista de {couple.name}</span>
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0 text-rose-300" aria-hidden />
          <span className="min-w-0 max-w-[12rem] truncate font-medium text-ink sm:max-w-md">
            {product.name}
          </span>
        </nav>

        {product.isOutOfStock ? (
          <div className="mx-auto mt-10 max-w-lg rounded-3xl border border-rose-100/90 bg-white/90 px-6 py-12 text-center shadow-soft backdrop-blur-sm sm:mt-14 sm:py-14">
            <div className="relative mx-auto mb-6 h-28 w-28 overflow-hidden rounded-2xl bg-rose-50 opacity-75 ring-1 ring-rose-100">
              <Image
                src={product.imageUrl}
                alt=""
                fill
                className="object-cover grayscale"
                sizes="112px"
              />
            </div>
            <p className="font-serif text-2xl text-ink sm:text-3xl">Esse presente foi escolhido!</p>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-mute sm:text-base">
              Volte para a lista e veja os demais presentes disponíveis.
            </p>
            <Link
              href={`/${couple.username}`}
              className="btn-primary mt-8 inline-flex min-h-12 justify-center px-8"
            >
              Ver outros presentes
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-10 lg:mt-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-start lg:gap-14 xl:gap-16">
            <div className="min-w-0 lg:pt-2">
              <div className="relative mx-auto aspect-[4/5] w-full max-w-lg overflow-hidden rounded-[1.75rem] bg-rose-50 shadow-bloom ring-1 ring-rose-100/90 sm:rounded-3xl lg:mx-0 lg:max-w-none lg:aspect-[4/5] lg:sticky lg:top-24">
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 44vw"
                  priority
                />
              </div>
            </div>

            <div className="min-w-0 space-y-8 lg:space-y-10">
              <div>
                <p className="label-eyebrow">Presente para</p>
                <p className="mt-2 font-serif text-2xl text-ink sm:text-3xl lg:text-4xl">
                  {couple.name}
                </p>
                <h1 className="mt-5 font-serif text-3xl leading-[1.15] tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
                  {product.name}
                </h1>
                {product.description ? (
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-mute sm:text-lg">
                    {product.description}
                  </p>
                ) : null}
                <div className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-2">
                  <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-white px-5 py-4 ring-1 ring-rose-100/90">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-mute">
                      Valor
                    </p>
                    <p className="mt-1 font-serif text-3xl tabular-nums text-rose-600 sm:text-4xl">
                      {formatBRL(product.priceCents)}
                    </p>
                  </div>
                  <p className="text-sm text-ink-mute">
                    Pagamento seguro com cartão, PIX ou boleto pelo Mercado Pago.
                  </p>
                </div>
              </div>

              <section
                className="rounded-[1.75rem] border border-rose-100/90 bg-white/90 p-5 shadow-[0_12px_50px_-18px_rgba(194,24,91,0.2)] backdrop-blur-md sm:p-8 sm:rounded-3xl lg:p-9"
                id="gift-checkout"
              >
                <GiftCheckout
                  username={couple.username}
                  productId={product.id}
                  productName={product.name}
                  amountCents={product.priceCents}
                  coupleName={couple.name}
                  productImageUrl={product.imageUrl}
                  productDescription={product.description}
                  compactProductSummary
                />
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
