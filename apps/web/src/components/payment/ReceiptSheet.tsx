'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { formatBRL, formatDateTime } from '@/lib/format';

import type { PaymentMethod } from '@repo/shared/payments';

interface ReceiptSheetProps {
  productName: string;
  amountCents: number;
  payerName: string;
  paymentMethod: PaymentMethod;
  paymentIntentId: string;
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  card: 'Cartão',
  pix: 'PIX',
  boleto: 'Boleto',
  debit_caixa: 'Débito virtual Caixa',
};

export function ReceiptSheet({
  productName,
  amountCents,
  payerName,
  paymentMethod,
  paymentIntentId,
}: ReceiptSheetProps) {
  return (
    <motion.div
      role="region"
      aria-label="Comprovante de presente"
      className="max-h-[min(88dvh,40rem)] overflow-y-auto overscroll-contain rounded-t-[1.75rem] border border-rose-100/80 bg-white shadow-bloom sm:max-h-none sm:rounded-3xl"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      initial={{ y: 48, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
    >
      <div className="flex justify-center pt-3 sm:hidden" aria-hidden>
        <span className="h-1 w-10 shrink-0 rounded-full bg-rose-200/90" />
      </div>
      <div className="relative overflow-hidden border-b border-rose-100/90 bg-gradient-to-br from-rose-50 via-white to-rose-50/40 px-5 py-6 text-center sm:rounded-t-3xl sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-rose-200/30 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-rose-300/20 blur-2xl" />
        <p className="label-eyebrow relative">Presente registrado</p>
        <h3 className="relative mt-2 font-serif text-2xl leading-tight text-ink sm:text-3xl">
          Obrigado, {payerName}!
        </h3>
      </div>
      <dl className="grid grid-cols-1 gap-5 px-5 py-6 text-sm sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5 sm:px-8 sm:py-7">
        <Row label="Presente">{productName}</Row>
        <Row label="Valor">{formatBRL(amountCents)}</Row>
        <Row label="Método">{METHOD_LABEL[paymentMethod]}</Row>
        <Row label="Data">{formatDateTime(new Date())}</Row>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wider text-ink-mute">Referência</dt>
          <dd className="mt-2 break-all rounded-xl bg-rose-50/90 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-ink-mute sm:text-xs">
            {paymentIntentId}
          </dd>
        </div>
      </dl>
      <div className="border-t border-rose-100/90 px-5 py-6 text-center sm:px-8 sm:py-7">
        <p className="text-sm leading-relaxed text-ink-mute">
          Sua mensagem foi enviada ao casal junto com o presente.
        </p>
        <Link
          href="/"
          className="btn-ghost mx-auto mt-5 inline-flex min-h-12 justify-center px-8"
        >
          <Heart className="h-4 w-4 shrink-0 text-rose-600" /> Voltar ao início
        </Link>
      </div>
    </motion.div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">{label}</dt>
      <dd className="mt-1.5 break-words text-base font-medium leading-snug text-ink">{children}</dd>
    </div>
  );
}
