'use client';

import { useFormState } from 'react-dom';
import { forgotPasswordAction, type PasswordState } from '@/actions/password';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { FieldError } from '@/components/forms/FieldError';

const initial: PasswordState = {};

export function ForgotForm() {
  const [state, formAction] = useFormState(forgotPasswordAction, initial);
  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state?.success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}
      <div>
        <label className="text-sm text-ink-soft" htmlFor="email">
          Seu e-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="input-field mt-1"
        />
        <FieldError errors={state?.fieldErrors?.email} />
      </div>
      <SubmitButton pendingLabel="Enviando...">Enviar link</SubmitButton>
    </form>
  );
}
