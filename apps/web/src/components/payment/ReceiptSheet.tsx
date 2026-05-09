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
      className="rounded-3xl bg-white shadow-bloom"
      initial={{ y: 80, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
    >
      <div className="border-b border-rose-100 bg-rose-50/60 px-6 py-5 text-center">
        <p className="label-eyebrow">Presente registrado</p>
        <h3 className="mt-1 font-serif text-3xl text-ink">Obrigado, {payerName}!</h3>
      </div>
      <dl className="grid grid-cols-2 gap-y-4 px-6 py-6 text-sm">
        <Row label="Presente">{productName}</Row>
        <Row label="Valor">{formatBRL(amountCents)}</Row>
        <Row label="Método">{METHOD_LABEL[paymentMethod]}</Row>
        <Row label="Data">{formatDateTime(new Date())}</Row>
        <div className="col-span-2 mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-ink-mute">
          <span className="font-mono">{paymentIntentId}</span>
        </div>
      </dl>
      <div className="border-t border-rose-100 px-6 py-5 text-center">
        <p className="text-sm text-ink-mute">
          Sua mensagem foi enviada ao casal junto com o presente.
        </p>
        <Link href="/" className="btn-ghost mt-4 inline-flex">
          <Heart className="h-4 w-4 text-rose-600" /> Voltar ao início
        </Link>
      </div>
    </motion.div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ink-mute">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{children}</dd>
    </div>
  );
}
