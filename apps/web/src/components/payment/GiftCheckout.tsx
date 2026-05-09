'use client';

// Checkout transparente — Mercado Pago (Payment Brick).
//
// Fluxo:
//   1. Tela "identify" — coletamos nome, e-mail, CPF e mensagem do pagador.
//   2. Tela "pay"      — renderizamos o Payment Brick (cartão de crédito,
//                         débito, PIX, boleto e débito virtual Caixa).
//   3. Tela "result"   — após o submit:
//                         - cartão aprovado → overlay confirmação + recibo
//                         - PIX             → QR + polling → mesma celebração ao aprovar
//                         - boleto/débito   → mesmo padrão após polling
//
// Overlay `PaymentFlow` também cobre o passo "pay" durante `processing`, para ver
// a animação de processamento mesmo antes de trocar de tela.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
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
import { apiClient, ApiError } from '@/lib/api-client';
import { initMP } from '@/lib/mercadopago-client';
import { formatBRL } from '@/lib/format';
import { PaymentFlow, type FlowState } from '@/components/payment/PaymentFlow';

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
}

interface PayerData {
  name: string;
  email: string;
  cpf: string;
  message: string;
}

export function GiftCheckout(props: GiftCheckoutProps) {
  const [step, setStep] = useState<'identify' | 'pay' | 'result'>('identify');
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
    setFlowState('processing');
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
    setStep('identify');
    setResult(null);
    setError(null);
    setFlowState('idle');
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

  if (step === 'identify') {
    return (
      <>
        <IdentifyForm
          amountCents={props.amountCents}
          payer={payer}
          onChange={setPayer}
          onSubmit={handleIdentify}
          error={error}
        />
        {paymentOverlay}
      </>
    );
  }

  if (step === 'pay') {
    return (
      <>
        <BrickStep
          amountCents={props.amountCents}
          payer={payer}
          onSubmit={handleSubmitBrick}
          onBack={handleBack}
          error={error}
        />
        {paymentOverlay}
      </>
    );
  }

  return (
    <>
      <ResultStep
        result={result!}
        productName={props.productName}
        payerName={payer.name}
        amountCents={props.amountCents}
        onBack={handleBack}
        onApprovedCelebration={startCelebrationSequence}
      />
      {paymentOverlay}
    </>
  );
}

// =============================================================================
// Step 1 — coleta de dados do pagador
// =============================================================================

interface IdentifyFormProps {
  amountCents: number;
  payer: PayerData;
  onChange: (next: PayerData) => void;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null;
}

function IdentifyForm({ amountCents, payer, onChange, onSubmit, error }: IdentifyFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <p className="label-eyebrow">Você está a um passo</p>
        <h2 className="mt-1 font-serif text-3xl text-ink">Quem está presenteando?</h2>
      </div>
      {error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
        <label className="text-sm text-ink-soft" htmlFor="payerMessage">
          Mensagem para o casal (opcional)
        </label>
        <textarea
          id="payerMessage"
          rows={3}
          className="input-field mt-1"
          value={payer.message}
          onChange={(e) => onChange({ ...payer, message: e.target.value })}
          placeholder="Felicidades para vocês!"
        />
      </div>
      <button type="submit" className="btn-primary w-full">
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
    <div>
      <label className="text-sm text-ink-soft" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input-field mt-1"
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
        // Bank transfer aceita string[] com chave 'pix'.
        bankTransfer: ['pix'],
        ticket: 'all',
        maxInstallments: 12,
      } as IPaymentBrickCustomization['paymentMethods'],
      visual: {
        style: { theme: 'default' },
        hideFormTitle: true,
      },
    }),
    [],
  );

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-ink-mute hover:text-rose-600"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <div>
        <p className="label-eyebrow">Pagamento</p>
        <h2 className="mt-1 font-serif text-3xl text-ink">Finalize com segurança</h2>
        <p className="mt-1 text-sm text-ink-mute">
          Aceitamos cartão, PIX, boleto e débito virtual Caixa via Mercado Pago.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-rose-100 bg-white/80 p-4">
        <PaymentBrick
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
    <div className="grid place-items-center rounded-2xl border border-rose-100 bg-white/60 px-4 py-12">
      <Loader2 className="h-5 w-5 animate-spin text-rose-500" />
      <p className="mt-2 text-sm text-ink-mute">Carregando o checkout do Mercado Pago...</p>
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
    <div className="space-y-4">
      <h2 className="font-serif text-2xl text-ink">Aguardando confirmação</h2>
      <p className="text-sm text-ink-mute">
        Estamos confirmando o pagamento. Pode levar alguns instantes — você não precisa fechar
        esta página.
      </p>
      <button onClick={onBack} className="btn-ghost mt-4 inline-flex">
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
  async function copy() {
    await navigator.clipboard.writeText(pix.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="space-y-4">
      <p className="label-eyebrow">PIX gerado</p>
      <h2 className="font-serif text-3xl text-ink">Escaneie para pagar</h2>
      <p className="text-sm text-ink-mute">
        {productName} — {formatBRL(amountCents)}. A confirmação chega em segundos depois do pagamento.
      </p>
      <div className="grid place-items-center rounded-2xl border border-rose-100 bg-white p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${pix.qrCodeBase64}`}
          alt="QR Code PIX"
          width={260}
          height={260}
          className="rounded-xl"
        />
      </div>
      <div>
        <label className="text-sm text-ink-soft">Copia e cola</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            readOnly
            className="input-field flex-1 font-mono text-xs"
            value={pix.qrCode}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button onClick={copy} type="button" className="btn-ghost">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
      <p className="text-xs text-ink-mute">
        Esperando pagamento... você pode fechar e voltar mais tarde — assim que o banco confirmar o
        PIX, enviaremos um e-mail.
      </p>
      <button onClick={onBack} className="btn-ghost inline-flex text-sm">
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
    <div className="space-y-4">
      <p className="label-eyebrow">Boleto gerado</p>
      <h2 className="font-serif text-3xl text-ink">Pague o boleto</h2>
      <p className="text-sm text-ink-mute">
        {productName} — {formatBRL(amountCents)}. A confirmação leva 1–3 dias úteis.
      </p>
      <a
        href={boleto.ticketUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary inline-flex"
      >
        <ExternalLink className="h-4 w-4" /> Abrir boleto
      </a>
      {boleto.barcode ? (
        <div>
          <label className="text-sm text-ink-soft">Linha digitável</label>
          <input
            readOnly
            className="input-field mt-1 font-mono text-xs"
            value={boleto.barcode}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      ) : null}
      <button onClick={onBack} className="btn-ghost inline-flex text-sm">
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
    <div className="space-y-4">
      <p className="label-eyebrow">Débito virtual Caixa</p>
      <h2 className="font-serif text-3xl text-ink">Conclua no app Caixa</h2>
      <p className="text-sm text-ink-mute">
        {productName} — {formatBRL(amountCents)}. Abra o link abaixo no celular onde você usa o app
        da Caixa para finalizar.
      </p>
      <a
        href={info.ticketUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary inline-flex"
      >
        <ExternalLink className="h-4 w-4" /> Abrir débito Caixa
      </a>
      <button onClick={onBack} className="btn-ghost inline-flex text-sm">
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
