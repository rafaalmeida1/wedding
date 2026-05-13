'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { PaymentMethod } from '@repo/shared/payments';
import { NfcCore } from './NfcCore';
import { ProcessingOrb } from './ProcessingOrb';
import { GeneratingMethodVisual } from './GeneratingMethodVisual';
import { SuccessBurst } from './SuccessBurst';
import { ReceiptSheet } from './ReceiptSheet';
import { ParticleField } from './ParticleField';

export type FlowState =
  | 'idle'
  | 'detecting'
  | 'generating_pix'
  | 'generating_boleto'
  | 'generating_debit_caixa'
  | 'processing'
  | 'approved'
  | 'receipt';

interface PaymentFlowProps {
  state: FlowState;
  productName: string;
  amountCents: number;
  payerName: string;
  paymentMethod?: PaymentMethod;
  paymentIntentId?: string;
}

export function PaymentFlow({
  state,
  productName,
  amountCents,
  payerName,
  paymentMethod = 'card',
  paymentIntentId,
}: PaymentFlowProps) {
  if (state === 'idle') return null;

  const showOverlay = state !== 'receipt';
  const particleMode =
    state === 'detecting' || state === 'generating_pix'
      ? 'orbit'
      : state === 'approved'
        ? 'burst'
        : 'ambient';

  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div
          key="overlay"
          className="fixed inset-0 z-50 grid place-items-center bg-cream/80 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          aria-live="polite"
        >
          <ParticleField mode={particleMode} className="absolute inset-0 h-full w-full" />
          <motion.div
            key={state}
            className="relative grid place-items-center gap-6 text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            {state === 'detecting' && (
              <>
                <NfcCore active />
                <p className="font-serif text-2xl text-ink">
                  Aproxime-se do pagamento...
                </p>
                <p className="text-sm text-ink-mute">
                  Validando dados com segurança
                </p>
              </>
            )}
            {state === 'generating_pix' && (
              <>
                <GeneratingMethodVisual variant="pix" />
                <p className="font-serif text-2xl text-ink">Gerando seu PIX</p>
                <p className="text-sm text-ink-mute">
                  Criando o QR Code seguro só para este presente...
                </p>
              </>
            )}
            {state === 'generating_boleto' && (
              <>
                <GeneratingMethodVisual variant="boleto" />
                <p className="font-serif text-2xl text-ink">Gerando boleto</p>
                <p className="text-sm text-ink-mute">
                  Montando o código de barras e o boleto desta compra.
                </p>
              </>
            )}
            {state === 'generating_debit_caixa' && (
              <>
                <GeneratingMethodVisual variant="debit_caixa" />
                <p className="font-serif text-2xl text-ink">Preparando débito Caixa</p>
                <p className="text-sm text-ink-mute">
                  Gerando o link para você concluir no app da Caixa.
                </p>
              </>
            )}
            {state === 'processing' && (
              <>
                <ProcessingOrb />
                <p className="font-serif text-2xl text-ink">Processando pagamento</p>
                <p className="text-sm text-ink-mute">Aguarde a confirmação do banco</p>
              </>
            )}
            {state === 'approved' && (
              <>
                <SuccessBurst />
                <motion.p
                  className="font-serif text-3xl text-ink md:text-4xl"
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.05 }}
                >
                  Pagamento confirmado
                </motion.p>
                <motion.p
                  className="text-sm text-ink-mute md:text-base"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35, duration: 0.4 }}
                >
                  Obrigado, {payerName}! Seu presente foi registrado com sucesso.
                </motion.p>
              </>
            )}
          </motion.div>
        </motion.div>
      )}

      {state === 'receipt' && (
        <motion.div
          key="receipt"
          className="fixed inset-0 z-50 grid place-items-end bg-ink/40 backdrop-blur md:place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="w-full max-w-md p-4 md:p-0">
            <ReceiptSheet
              productName={productName}
              amountCents={amountCents}
              payerName={payerName}
              paymentMethod={paymentMethod}
              paymentIntentId={paymentIntentId ?? '—'}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
