'use client';

// Checkout transparente — Mercado Pago (Payment Brick).
//
// Fluxo por etapas (checkout):
//   0. "product"  — resumo: foto, casal, presente, valor → continuar
//   1. "identify" — dados do pagador
//   2. "pay"       — Payment Brick (MP)
//   3. "result"    — PIX / boleto / Caixa / sucesso
//                         - cartão aprovado → overlay confirmação + recibo
//                         - PIX             → QR + polling → mesma celebração ao aprovar
//                         - boleto/débito   → mesmo padrão após polling
//
// Overlay `PaymentFlow` cobre o passo "pay" enquanto o POST /api/payments corre:
//   - PIX / boleto / Caixa → "Gerando…" (visual próprio por método)
//   - Cartão → "Processando pagamento"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Loader2, ArrowLeft, ExternalLink, Copy, Check } from 'lucide-react';
// O `IPaymentBrickCustomization` não é re-exportado pelo entry principal do
// `@mercadopago/sdk-react`, mas o pacote não tem campo `exports` então o deep
// import via subpath é suportado.
import type { IPaymentBrickCustomization } from '@mercadopago/sdk-react/esm/bricks/payment/type';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentStatusResult,
} from '@repo/shared/payments';
import { detectPaymentMethod } from '@repo/shared/payments';
import { apiClient, ApiError } from '@/lib/api-client';
import { initMP } from '@/lib/mercadopago-client';
import { formatBRL } from '@/lib/format';
import { PaymentFlow, type FlowState } from '@/components/payment/PaymentFlow';
import { motion } from 'framer-motion';

// Carregamos o Brick com SSR desabilitado para evitar acessar `window` no servidor.
const PaymentBrick = dynamic(
  () => import('@mercadopago/sdk-react').then((mod) => mod.Payment),
  { ssr: false, loading: () => <BrickFallback /> },
);

interface GiftCheckoutProps {
  username: string;
  productId: string;
  productName: string;
  amountCents: number;
  coupleName: string;
  productImageUrl: string;
  productDescription: string | null;
  /** Quando a página já mostra foto grande (PDP); etapa 1 vira só confirmação em texto. */
  compactProductSummary?: boolean;
}

interface PayerData {
  name: string;
  email: string;
  cpf: string;
  message: string;
}

export function GiftCheckout(props: GiftCheckoutProps) {
  const [step, setStep] = useState<'product' | 'identify' | 'pay' | 'result'>('product');
  const [payer, setPayer] = useState<PayerData>({
    name: '',
    email: '',
    cpf: '',
    message: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatePaymentResult | null>(null);
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const celebrationLockRef = useRef(false);
  const receiptDelayRef = useRef<ReturnType<typeof setTimeout> | undefined>();
  const checkoutRef = useRef<HTMLDivElement>(null);

  /** Scroll suave até o bloco do checkout quando o fluxo muda (overlay, resultado, Brick). */
  const scrollCheckoutIntoView = useCallback(() => {
    if (typeof window === 'undefined') return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.requestAnimationFrame(() => {
      checkoutRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'start',
        inline: 'nearest',
      });
    });
  }, []);

  /** Evita replay da animação (Strict Mode ou double poll) e faz approved → receipt. */
  const startCelebrationSequence = useCallback(() => {
    if (celebrationLockRef.current) return;
    celebrationLockRef.current = true;
    setFlowState('approved');
    clearTimeout(receiptDelayRef.current);
    receiptDelayRef.current = setTimeout(() => setFlowState('receipt'), 1600);
  }, []);

  useEffect(() => {
    return () => clearTimeout(receiptDelayRef.current);
  }, []);

  useEffect(() => {
    if (step === 'pay') initMP();
  }, [step]);

  useEffect(() => {
    if (flowState !== 'idle') scrollCheckoutIntoView();
  }, [flowState, scrollCheckoutIntoView]);

  useEffect(() => {
    if (step === 'product') return;
    scrollCheckoutIntoView();
  }, [step, scrollCheckoutIntoView]);

  function handleIdentify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidCpfDigits(payer.cpf)) {
      setError('CPF inválido — digite 11 dígitos.');
      return;
    }
    setStep('pay');
  }

  // O Brick chama `onSubmit` ao confirmar — `formData` traz cartão/método.
  async function handleSubmitBrick(formData: BrickFormData): Promise<void> {
    setError(null);
    celebrationLockRef.current = false;
    setFlowState(brickSubmitOverlayState(formData));
    try {
      const body: CreatePaymentInput = {
        username: props.username,
        productId: props.productId,
        payerName: payer.name,
        payerEmail: formData.payer?.email ?? payer.email,
        payerMessage: payer.message,
        payerIdentification: {
          type:
            (formData.payer?.identification?.type?.toUpperCase() as 'CPF' | 'CNPJ') ??
            'CPF',
          number: formData.payer?.identification?.number ?? payer.cpf,
        },
        token: formData.token,
        installments: formData.installments ?? 1,
        mpPaymentMethodId: formData.payment_method_id,
        mpPaymentTypeId: formData.payment_type_id as
          | 'credit_card'
          | 'debit_card'
          | 'bank_transfer'
          | 'ticket'
          | undefined,
        issuerId: formData.issuer_id,
      };
      const res = await apiClient.post<CreatePaymentResult>('/api/payments', body);
      setResult(res);

      if (res.status === 'approved') {
        startCelebrationSequence();
      } else if (res.status === 'failed') {
        setFlowState('idle');
        celebrationLockRef.current = false;
        setError('Pagamento recusado. Tente outro método ou verifique os dados.');
        return;
      } else {
        // pending: PIX / boleto / débito Caixa — overlay some; celebração ao pollar `approved`
        setFlowState('idle');
      }
      setStep('result');
    } catch (err) {
      setFlowState('idle');
      celebrationLockRef.current = false;
      const msg = err instanceof ApiError ? err.message : 'Falha de comunicação';
      setError(msg);
      throw err; // o Brick também trata internamente
    }
  }

  function handleBack() {
    clearTimeout(receiptDelayRef.current);
    celebrationLockRef.current = false;
    setError(null);
    setFlowState('idle');
    if (step === 'result') {
      setResult(null);
      setStep('identify');
      return;
    }
    if (step === 'pay') {
      setStep('identify');
      return;
    }
    if (step === 'identify') {
      setStep('product');
    }
  }

  // ---------- render --------------------------------------------------------

  const paymentOverlay =
    flowState !== 'idle' ? (
      <PaymentFlow
        state={flowState}
        productName={props.productName}
        amountCents={props.amountCents}
        payerName={payer.name}
        paymentMethod={result?.paymentMethod ?? 'card'}
        paymentIntentId={result?.mpPaymentId ?? '—'}
      />
    ) : null;

  const main = (
    <>
      {step !== 'result' ? <CheckoutStepper phase={step} /> : null}
      {step === 'product' ? (
        <ProductSummaryStep
          coupleName={props.coupleName}
          productName={props.productName}
          productDescription={props.productDescription}
          amountCents={props.amountCents}
          imageUrl={props.productImageUrl}
          compact={props.compactProductSummary}
          onContinue={() => {
            setError(null);
            setStep('identify');
          }}
        />
      ) : step === 'identify' ? (
        <IdentifyForm
          amountCents={props.amountCents}
          payer={payer}
          onChange={setPayer}
          onSubmit={handleIdentify}
          onBack={() => {
            setError(null);
            setStep('product');
          }}
          error={error}
        />
      ) : step === 'pay' ? (
        <BrickStep
          amountCents={props.amountCents}
          payer={payer}
          onSubmit={handleSubmitBrick}
          onBack={handleBack}
          error={error}
        />
      ) : (
        <ResultStep
          result={result!}
          productName={props.productName}
          payerName={payer.name}
          amountCents={props.amountCents}
          onBack={handleBack}
          onApprovedCelebration={startCelebrationSequence}
        />
      )}
    </>
  );

  return (
    <div
      ref={checkoutRef}
      className="scroll-mt-4 outline-none sm:scroll-mt-6"
      tabIndex={-1}
    >
      {main}
      {paymentOverlay}
    </div>
  );
}

// =============================================================================
// Etapas — indicador + resumo do produto
// =============================================================================

type CheckoutPhase = 'product' | 'identify' | 'pay';

function CheckoutStepper({ phase }: { phase: CheckoutPhase }) {
  const index = phase === 'product' ? 0 : phase === 'identify' ? 1 : 2;
  const pct = ((index + 1) / 3) * 100;
  const title = index === 0 ? 'Resumo do presente' : index === 1 ? 'Seus dados' : 'Pagamento';

  return (
    <nav aria-label="Etapas do checkout" className="mb-6 sm:mb-8">
      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute sm:text-xs">
        <span>Checkout</span>
        <span className="tabular-nums text-rose-600">{index + 1} / 3</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-rose-100">
        <div
          className="h-full rounded-full bg-rose-600 transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-3 font-medium leading-snug text-ink sm:text-[15px]">{title}</p>
    </nav>
  );
}

function ProductSummaryStep({
  coupleName,
  productName,
  productDescription,
  amountCents,
  imageUrl: _imageUrl,
  compact,
  onContinue,
}: {
  coupleName: string;
  productName: string;
  productDescription: string | null;
  amountCents: number;
  imageUrl: string;
  compact?: boolean;
  onContinue: () => void;
}) {
  if (compact) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <header>
          <p className="label-eyebrow">Confirmar</p>
          <h2 className="mt-2 font-serif text-xl leading-tight text-ink sm:text-2xl">
            Tudo certo para seguir?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-mute sm:text-[15px]">
            Os dados do presente já estão acima. Na próxima etapa você preenche seus dados e depois
            o pagamento.
          </p>
        </header>
        <div className="rounded-2xl border border-rose-100/80 bg-gradient-to-br from-white to-rose-50/25 px-4 py-4 sm:px-5 sm:py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-mute">Resumo</p>
          <p className="mt-1 font-medium text-ink">
            <span className="text-ink-mute">Para</span> {coupleName}
          </p>
          <p className="mt-2 font-serif text-lg text-ink">{productName}</p>
          <p className="mt-3 font-serif text-xl tabular-nums text-rose-600 sm:text-2xl">
            {formatBRL(amountCents)}
          </p>
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="btn-primary min-h-12 w-full text-base shadow-[0_12px_36px_-16px_rgba(194,24,91,0.45)]"
        >
          Continuar — meus dados
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <header>
        <p className="label-eyebrow">Antes de pagar</p>
        <h2 className="mt-2 font-serif text-2xl leading-tight tracking-tight text-ink sm:text-3xl">
          Confira o presente
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-mute sm:text-[15px]">
          Na próxima etapa você informa seus dados; depois escolhe como pagar com segurança pelo
          Mercado Pago.
        </p>
      </header>

      <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl bg-rose-50 shadow-soft ring-1 ring-rose-100/90 sm:aspect-[5/4] sm:rounded-3xl">
        <Image
          src={_imageUrl}
          alt={productName}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 28rem"
          priority
        />
      </div>

      <div className="rounded-2xl border border-rose-100/80 bg-gradient-to-br from-white to-rose-50/30 px-4 py-5 sm:px-6 sm:py-6">
        <p className="label-eyebrow text-[10px] sm:text-xs">Presente para</p>
        <p className="mt-1 font-serif text-xl text-ink sm:text-2xl">{coupleName}</p>
        <h3 className="mt-4 font-serif text-lg leading-snug text-ink sm:text-xl">{productName}</h3>
        {productDescription ? (
          <p className="mt-2 text-sm leading-relaxed text-ink-mute sm:text-[15px]">
            {productDescription}
          </p>
        ) : null}
        <p className="mt-5 font-serif text-2xl tabular-nums text-rose-600 sm:text-3xl">
          {formatBRL(amountCents)}
        </p>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="btn-primary min-h-12 w-full text-base shadow-[0_12px_36px_-16px_rgba(194,24,91,0.45)]"
      >
        Continuar — meus dados
      </button>
    </div>
  );
}

// =============================================================================
// Step — coleta de dados do pagador
// =============================================================================

interface IdentifyFormProps {
  amountCents: number;
  payer: PayerData;
  onChange: (next: PayerData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  error: string | null;
}

function IdentifyForm({ amountCents, payer, onChange, onSubmit, onBack, error }: IdentifyFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-5 sm:space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-2 rounded-full py-1.5 pl-1 pr-3 text-sm font-medium text-ink-mute transition hover:bg-white/80 hover:text-rose-700 active:scale-[0.99]"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" /> Voltar ao resumo
      </button>
      <header>
        <p className="label-eyebrow">Quase lá</p>
        <h2 className="mt-2 font-serif text-2xl leading-tight tracking-tight text-ink sm:text-3xl md:text-[2rem]">
          Quem está presenteando?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-mute sm:text-[15px]">
          Esses dados entram no comprovante para o casal. O Mercado Pago exige CPF para PIX e
          boleto.
        </p>
      </header>
      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200/90 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-800"
        >
          {error}
        </p>
      ) : null}
      <Field
        id="payerName"
        label="Seu nome completo"
        value={payer.name}
        onChange={(v) => onChange({ ...payer, name: v })}
        required
      />
      <Field
        id="payerEmail"
        label="E-mail"
        type="email"
        value={payer.email}
        onChange={(v) => onChange({ ...payer, email: v })}
        required
      />
      <Field
        id="payerCpf"
        label="CPF (necessário p/ PIX e boleto)"
        value={formatCpf(payer.cpf)}
        onChange={(v) => onChange({ ...payer, cpf: onlyDigits(v).slice(0, 11) })}
        placeholder="000.000.000-00"
        inputMode="numeric"
        required
      />
      <div>
        <label className="text-sm font-medium text-ink-soft" htmlFor="payerMessage">
          Mensagem para o casal (opcional)
        </label>
        <textarea
          id="payerMessage"
          rows={3}
          className="input-field mt-2 min-h-[5.5rem] resize-y"
          value={payer.message}
          onChange={(e) => onChange({ ...payer, message: e.target.value })}
          placeholder="Felicidades para vocês!"
        />
      </div>
      <button type="submit" className="btn-primary min-h-12 w-full text-base shadow-[0_12px_36px_-16px_rgba(194,24,91,0.45)]">
        Continuar para o pagamento — {formatBRL(amountCents)}
      </button>
    </form>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'value' | 'onChange'>;

function Field({ id, label, value, onChange, ...rest }: FieldProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-ink-soft" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input-field min-h-12"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </div>
  );
}

// =============================================================================
// Step 2 — Mercado Pago Payment Brick
// =============================================================================

// Forma do `formData` que o Brick passa em `onSubmit`. Tipagem oficial não é
// 100% pública; mantemos uma definição local conservadora.
interface BrickFormData {
  payment_method_id: string;
  payment_type_id?: string;
  token?: string;
  installments?: number;
  issuer_id?: string;
  transaction_amount?: number;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
    first_name?: string;
    last_name?: string;
  };
}


interface BrickStepProps {
  amountCents: number;
  payer: PayerData;
  onSubmit: (formData: BrickFormData) => Promise<void>;
  onBack: () => void;
  error: string | null;
}

function BrickStep({ amountCents, payer, onSubmit, onBack, error }: BrickStepProps) {
  const initialization = useMemo(
    () => ({
      amount: amountCents / 100,
      payer: {
        firstName: payer.name.split(' ')[0],
        lastName: payer.name.split(' ').slice(1).join(' ') || undefined,
        email: payer.email,
      },
    }),
    [amountCents, payer.email, payer.name],
  );

  const customization: IPaymentBrickCustomization = useMemo(
    () => ({
      paymentMethods: {
        creditCard: 'all',
        debitCard: 'all',
        bankTransfer: ['pix'],
        ticket: 'all',
        maxInstallments: 12,
      } as IPaymentBrickCustomization['paymentMethods'],
      visual: {
        hideFormTitle: true,
        hideRedirectionPanel: true,
        style: {
          /* `flat` evita painéis muito escuros que o tema default às vezes aplica em sub-formulários (ex.: e-mail PIX). */
          theme: 'flat',
          customVariables: {
            baseColor: '#C2185B',
            baseColorFirstVariant: '#D5497F',
            baseColorSecondVariant: '#FFF1F5',
            secondaryColor: '#5c5466',
            /* Fundo explícito claro — evita inputs “filled” escuros */
            formBackgroundColor: '#FFFFFF',
            inputBackgroundColor: '#FFFFFF',
            textPrimaryColor: '#1F1B24',
            textSecondaryColor: '#5c5466',
            outlinePrimaryColor: '#C2185B',
            outlineSecondaryColor: '#F8BBD9',
            errorColor: '#9C124A',
            successColor: '#2E7D32',
            buttonTextColor: '#FFFFFF',
            fontSizeExtraSmall: '12px',
            fontSizeSmall: '13px',
            fontSizeMedium: '14px',
            fontSizeLarge: '15px',
            fontSizeExtraLarge: '16px',
            borderRadiusSmall: '10px',
            borderRadiusMedium: '12px',
            borderRadiusLarge: '16px',
            formPadding: '12px',
            inputVerticalPadding: '14px',
            inputHorizontalPadding: '14px',
            inputBorderWidth: '1px',
            inputFocusedBorderWidth: '2px',
            inputFocusedBoxShadow: '0 0 0 3px rgba(194, 24, 91, 0.15)',
          },
        },
      },
    }),
    [],
  );

  return (
    <div className="space-y-6 sm:space-y-7">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-2 rounded-full py-1.5 pl-1 pr-3 text-sm font-medium text-ink-mute transition hover:bg-white/80 hover:text-rose-700 active:scale-[0.99]"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" /> Voltar
      </button>
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-600">Pagamento</p>
        <h2 className="font-sans text-xl font-semibold leading-snug text-ink sm:text-2xl">
          Escolha como pagar
        </h2>
        <p className="text-sm leading-relaxed text-ink-mute sm:text-[15px]">
          Cartão, PIX, boleto ou débito virtual Caixa — processado pelo Mercado Pago.
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-rose-200/90 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-800"
        >
          {error}
        </p>
      ) : null}

      <div className="mp-brick-shell w-full min-w-0 overflow-x-auto rounded-2xl border border-rose-100/90 bg-white px-3 py-4 shadow-soft sm:rounded-3xl sm:px-4 sm:py-6 [-webkit-overflow-scrolling:touch]">
        <PaymentBrick
          id="gift-payment-brick"
          locale="pt"
          initialization={initialization}
          customization={customization}
          onSubmit={async ({ formData }) => {
            await onSubmit(formData as BrickFormData);
          }}
          onError={(err: unknown) => {
            console.error('[mp-brick] error', err);
          }}
        />
      </div>
    </div>
  );
}

function BrickFallback() {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-rose-200 bg-white/70 px-4 py-14 sm:rounded-3xl sm:py-16">
      <Loader2 className="h-7 w-7 animate-spin text-rose-500" strokeWidth={2.25} />
      <p className="mt-4 max-w-xs text-center text-sm leading-relaxed text-ink-mute">
        Carregando o checkout seguro do Mercado Pago...
      </p>
    </div>
  );
}

// =============================================================================
// Step 3 — resultado (PIX/boleto/débito) com polling
// =============================================================================

interface ResultStepProps {
  result: CreatePaymentResult;
  productName: string;
  payerName: string;
  amountCents: number;
  onBack: () => void;
  /** Chamado quando o polling passa de pendente → aprovado (PIX/boleto/débito). */
  onApprovedCelebration?: () => void;
}

function ResultStep({
  result,
  productName,
  payerName,
  amountCents,
  onBack,
  onApprovedCelebration,
}: ResultStepProps) {
  const [status, setStatus] = useState(result.status);
  const [, setStatusDetail] = useState(result.statusDetail);
  const prevStatusRef = useRef(result.status);

  // Celebração para pagamentos que nasceram `pending` e viram `approved` no polling.
  useEffect(() => {
    const prev = prevStatusRef.current;
    if (
      prev !== 'approved' &&
      status === 'approved' &&
      result.status === 'pending' &&
      onApprovedCelebration
    ) {
      onApprovedCelebration();
    }
    prevStatusRef.current = status;
  }, [status, result.status, onApprovedCelebration]);

  // Polling de status (PIX/boleto/débito virtual Caixa).
  useEffect(() => {
    if (status === 'approved' || status === 'failed') return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await apiClient.get<PaymentStatusResult>(
          `/api/payments/${result.paymentId}/status`,
        );
        if (cancelled) return;
        setStatus(res.status);
        setStatusDetail(res.statusDetail);
      } catch {
        // ignora; tentaremos de novo no próximo tick
      }
    };
    const interval = window.setInterval(tick, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [status, result.paymentId]);

  if (status === 'approved') {
    return (
      <div className="sr-only" aria-live="polite">
        Pagamento confirmado. Se o comprovante não aparecer, use o botão na janela acima.
      </div>
    );
  }

  if (result.paymentMethod === 'pix' && result.pix) {
    return (
      <PixCard
        pix={result.pix}
        productName={productName}
        amountCents={amountCents}
        onBack={onBack}
      />
    );
  }
  if (result.paymentMethod === 'boleto' && result.boleto) {
    return (
      <BoletoCard
        boleto={result.boleto}
        productName={productName}
        amountCents={amountCents}
        onBack={onBack}
      />
    );
  }
  if (result.paymentMethod === 'debit_caixa' && result.debitCaixa) {
    return (
      <DebitCaixaCard
        info={result.debitCaixa}
        productName={productName}
        amountCents={amountCents}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-7">
      <h2 className="font-serif text-xl text-ink sm:text-2xl">Aguardando confirmação</h2>
      <p className="text-sm leading-relaxed text-ink-mute sm:text-base">
        Estamos confirmando o pagamento. Pode levar alguns instantes — você não precisa fechar
        esta página.
      </p>
      <button onClick={onBack} className="btn-ghost mt-2 inline-flex min-h-12 w-full justify-center sm:w-auto">
        Tentar outro método
      </button>
    </div>
  );
}

function PixCard({
  pix,
  productName,
  amountCents,
  onBack,
}: {
  pix: NonNullable<CreatePaymentResult['pix']>;
  productName: string;
  amountCents: number;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [userMarkedPaid, setUserMarkedPaid] = useState(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMarkedPaid) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.requestAnimationFrame(() => {
      confirmRef.current?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'nearest',
      });
    });
  }, [userMarkedPaid]);

  async function copy() {
    await navigator.clipboard.writeText(pix.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="space-y-6 sm:space-y-7">
      <header>
        <p className="label-eyebrow">PIX gerado</p>
        <h2 className="mt-2 font-serif text-2xl leading-tight text-ink sm:text-3xl">
          Escaneie para pagar
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-mute sm:text-[15px]">
          <span className="font-medium text-ink">{productName}</span>
          <span className="text-ink-mute"> — {formatBRL(amountCents)}</span>
          <span className="block mt-1 text-ink-mute">
            A confirmação chega em segundos depois que o PIX cair.
          </span>
        </p>
      </header>
      <div className="grid place-items-center overflow-hidden rounded-2xl border border-rose-100/90 bg-white p-4 shadow-soft sm:rounded-3xl sm:p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${pix.qrCodeBase64}`}
          alt="QR Code PIX"
          width={260}
          height={260}
          className="h-auto w-full max-w-[min(18rem,100%)] rounded-xl sm:max-w-[16.25rem]"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-ink-soft">Copia e cola</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <input
            readOnly
            className="input-field min-h-12 flex-1 font-mono text-xs sm:text-sm"
            value={pix.qrCode}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            onClick={copy}
            type="button"
            className="btn-ghost inline-flex min-h-12 shrink-0 justify-center sm:px-5"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
      {userMarkedPaid ? (
        <div
          ref={confirmRef}
          className="rounded-2xl border border-rose-200/90 bg-gradient-to-br from-rose-50 to-white px-4 py-4 sm:px-5"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <motion.span
              className="h-11 w-11 shrink-0 rounded-full border-2 border-rose-500 border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="font-semibold text-ink">Processando pagamento</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-mute sm:text-sm">
                Confirmando com o Mercado Pago e o banco. Isso costuma levar só alguns segundos.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-ink-mute sm:text-sm">
            Depois de pagar no app do banco, toque abaixo para acompanharmos a confirmação. Você
            também pode fechar a página — enviaremos um e-mail quando o PIX for confirmado.
          </p>
          <button
            type="button"
            onClick={() => setUserMarkedPaid(true)}
            className="btn-primary min-h-12 w-full text-[15px] shadow-[0_12px_36px_-16px_rgba(194,24,91,0.45)]"
          >
            Já paguei o PIX
          </button>
        </div>
      )}
      <button
        onClick={onBack}
        className="btn-ghost inline-flex min-h-11 w-full justify-center text-sm sm:w-auto"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
    </div>
  );
}

function BoletoCard({
  boleto,
  productName,
  amountCents,
  onBack,
}: {
  boleto: NonNullable<CreatePaymentResult['boleto']>;
  productName: string;
  amountCents: number;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6 sm:space-y-7">
      <header>
        <p className="label-eyebrow">Boleto gerado</p>
        <h2 className="mt-2 font-serif text-2xl leading-tight text-ink sm:text-3xl">Pague o boleto</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-mute sm:text-[15px]">
          <span className="font-medium text-ink">{productName}</span> — {formatBRL(amountCents)}. A
          confirmação leva em geral 1–3 dias úteis.
        </p>
      </header>
      <a
        href={boleto.ticketUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary inline-flex min-h-12 w-full justify-center text-[15px] shadow-[0_12px_36px_-16px_rgba(194,24,91,0.45)]"
      >
        <ExternalLink className="h-4 w-4 shrink-0" /> Abrir boleto
      </a>
      {boleto.barcode ? (
        <div>
          <label className="text-sm font-medium text-ink-soft">Linha digitável</label>
          <input
            readOnly
            className="input-field mt-2 min-h-12 font-mono text-xs sm:text-sm"
            value={boleto.barcode}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      ) : null}
      <button
        onClick={onBack}
        className="btn-ghost inline-flex min-h-11 w-full justify-center text-sm sm:w-auto"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
    </div>
  );
}

function DebitCaixaCard({
  info,
  productName,
  amountCents,
  onBack,
}: {
  info: NonNullable<CreatePaymentResult['debitCaixa']>;
  productName: string;
  amountCents: number;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6 sm:space-y-7">
      <header>
        <p className="label-eyebrow">Débito virtual Caixa</p>
        <h2 className="mt-2 font-serif text-2xl leading-tight text-ink sm:text-3xl">
          Conclua no app Caixa
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-mute sm:text-[15px]">
          <span className="font-medium text-ink">{productName}</span> — {formatBRL(amountCents)}.
          Abra o link no celular em que você usa o app da Caixa para finalizar.
        </p>
      </header>
      <a
        href={info.ticketUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary inline-flex min-h-12 w-full justify-center text-[15px] shadow-[0_12px_36px_-16px_rgba(194,24,91,0.45)]"
      >
        <ExternalLink className="h-4 w-4 shrink-0" /> Abrir débito Caixa
      </a>
      <button
        onClick={onBack}
        className="btn-ghost inline-flex min-h-11 w-full justify-center text-sm sm:w-auto"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function onlyDigits(v: string): string {
  return v.replace(/\D+/g, '');
}

function formatCpf(digits: string): string {
  const d = onlyDigits(digits).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function isValidCpfDigits(v: string): boolean {
  return onlyDigits(v).length === 11;
}

/** Overlay durante o POST /api/payments: cada método com visual próprio até a resposta. */
function brickSubmitOverlayState(fd: BrickFormData): FlowState {
  const m = detectPaymentMethod({
    paymentMethodId: fd.payment_method_id,
    paymentTypeId: fd.payment_type_id,
  });
  if (m === 'pix') return 'generating_pix';
  if (m === 'boleto') return 'generating_boleto';
  if (m === 'debit_caixa') return 'generating_debit_caixa';
  return 'processing';
}
