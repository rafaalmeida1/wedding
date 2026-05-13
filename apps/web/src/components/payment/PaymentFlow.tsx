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

const overlayPad = {
  paddingTop: 'max(1rem, env(safe-area-inset-top))',
  paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
} as const;

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
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={overlayPad}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          aria-live="polite"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-rose-100/50 via-cream/92 to-cream backdrop-blur-[2px]"
            aria-hidden
          />
          <ParticleField mode={particleMode} className="absolute inset-0 h-full w-full" />
          <motion.div
            key={state}
            className="relative z-10 mx-auto w-full max-w-[min(100%,24rem)] px-3 sm:max-w-lg sm:px-5"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div className="rounded-[1.75rem] border border-white/70 bg-white/85 px-5 py-7 shadow-bloom backdrop-blur-xl sm:rounded-3xl sm:px-10 sm:py-9">
              <div className="grid place-items-center gap-5 text-center sm:gap-6">
                {state === 'detecting' && (
                  <>
                    <NfcCore active />
                    <p className="font-serif text-xl text-ink sm:text-2xl">
                      Aproxime-se do pagamento...
                    </p>
                    <p className="max-w-xs text-sm leading-relaxed text-ink-mute">
                      Validando dados com segurança
                    </p>
                  </>
                )}
                {state === 'generating_pix' && (
                  <>
                    <GeneratingMethodVisual variant="pix" size={168} />
                    <p className="font-serif text-xl text-ink sm:text-2xl md:text-3xl">
                      Gerando seu PIX
                    </p>
                    <p className="max-w-sm text-sm leading-relaxed text-ink-mute">
                      Criando o QR Code seguro só para este presente...
                    </p>
                  </>
                )}
                {state === 'generating_boleto' && (
                  <>
                    <GeneratingMethodVisual variant="boleto" />
                    <p className="font-serif text-xl text-ink sm:text-2xl md:text-3xl">
                      Gerando boleto
                    </p>
                    <p className="max-w-sm text-sm leading-relaxed text-ink-mute">
                      Montando o código de barras e o boleto desta compra.
                    </p>
                  </>
                )}
                {state === 'generating_debit_caixa' && (
                  <>
                    <GeneratingMethodVisual variant="debit_caixa" />
                    <p className="font-serif text-xl text-ink sm:text-2xl md:text-3xl">
                      Preparando débito Caixa
                    </p>
                    <p className="max-w-sm text-sm leading-relaxed text-ink-mute">
                      Gerando o link para você concluir no app da Caixa.
                    </p>
                  </>
                )}
                {state === 'processing' && (
                  <>
                    <ProcessingOrb size={168} />
                    <p className="font-serif text-xl text-ink sm:text-2xl md:text-3xl">
                      Processando pagamento
                    </p>
                    <p className="max-w-sm text-sm leading-relaxed text-ink-mute">
                      Aguarde a confirmação do banco
                    </p>
                  </>
                )}
                {state === 'approved' && (
                  <>
                    <SuccessBurst />
                    <motion.p
                      className="font-serif text-2xl text-ink sm:text-3xl md:text-4xl"
                      initial={{ opacity: 0, y: 20, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 22, delay: 0.05 }}
                    >
                      Pagamento confirmado
                    </motion.p>
                    <motion.p
                      className="max-w-sm text-sm leading-relaxed text-ink-mute sm:text-base"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.35, duration: 0.4 }}
                    >
                      Obrigado, {payerName}! Seu presente foi registrado com sucesso.
                    </motion.p>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {state === 'receipt' && (
        <motion.div
          key="receipt"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 backdrop-blur-sm sm:items-center"
          style={overlayPad}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="w-full max-w-md px-3 pb-2 sm:p-4 md:px-0 md:pb-0">
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
