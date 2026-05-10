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
    <main className="relative min-h-screen overflow-hidden bg-cream">
      <FloralBackdrop />
      <div className="relative mx-auto max-w-5xl px-6 py-12">
        <Link
          href={`/${couple.username}`}
          className="inline-flex items-center gap-1 text-sm text-ink-mute hover:text-rose-600"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para a lista
        </Link>

        <div className="mt-8 grid gap-10 md:grid-cols-[5fr_6fr]">
          <aside className="space-y-6">
            <div className="overflow-hidden rounded-3xl bg-rose-50 shadow-bloom">
              <Image
                src={product.imageUrl}
                alt={product.name}
                width={700}
                height={700}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="label-eyebrow">Presente para</p>
              <h2 className="font-serif text-3xl text-ink">{couple.name}</h2>
            </div>
            <div>
              <h1 className="font-serif text-4xl text-ink">{product.name}</h1>
              {product.description ? (
                <p className="mt-2 text-ink-mute">{product.description}</p>
              ) : null}
              <p className="mt-4 font-serif text-3xl text-rose-600">
                {formatBRL(product.priceCents)}
              </p>
            </div>
          </aside>

          <section className="card-soft">
            {product.isOutOfStock ? (
              <div className="rounded-2xl bg-rose-50 p-8 text-center">
                <p className="font-serif text-2xl text-ink">Esse presente foi escolhido!</p>
                <p className="mt-2 text-ink-mute">
                  Volte para a lista e veja os demais.
                </p>
                <Link
                  href={`/${couple.username}`}
                  className="btn-primary mt-6 inline-flex"
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
        </div>
      </div>
    </main>
  );
}
