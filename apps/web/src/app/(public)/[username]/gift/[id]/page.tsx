import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { z } from 'zod';
import { usernameSchema } from '@repo/shared/auth';
import { getPublicGift } from '@/lib/public-api';
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
      <div className="relative mx-auto max-w-xl px-4 pb-12 pt-4 sm:px-6 sm:pb-16 sm:pt-8 lg:max-w-2xl lg:pt-10">
        <Link
          href={`/${couple.username}`}
          className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-full px-2 py-2 text-sm text-ink-mute transition hover:bg-white/60 hover:text-rose-700 active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Voltar para a lista</span>
        </Link>

        <section
          className="mt-6 rounded-[1.75rem] border border-rose-100/90 bg-white/90 p-5 shadow-[0_12px_50px_-18px_rgba(194,24,91,0.22)] backdrop-blur-md sm:mt-8 sm:p-8 sm:rounded-3xl lg:p-10"
          id="gift-checkout"
        >
          {product.isOutOfStock ? (
            <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-white px-4 py-10 text-center sm:px-8 sm:py-12">
              <p className="font-serif text-2xl text-ink sm:text-3xl">Esse presente foi escolhido!</p>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-ink-mute sm:text-base">
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
              coupleName={couple.name}
              productImageUrl={product.imageUrl}
              productDescription={product.description}
            />
          )}
        </section>
      </div>
    </main>
  );
}
