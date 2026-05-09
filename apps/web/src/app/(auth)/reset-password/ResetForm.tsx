'use client';

import { useFormState } from 'react-dom';
import { resetPasswordAction, type PasswordState } from '@/actions/password';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { FieldError } from '@/components/forms/FieldError';

const initial: PasswordState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, formAction] = useFormState(
    resetPasswordAction.bind(null, token),
    initial,
  );
  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}
      <div>
        <label className="text-sm text-ink-soft" htmlFor="password">
          Nova senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="input-field mt-1"
        />
        <FieldError errors={state?.fieldErrors?.password} />
      </div>
      <SubmitButton pendingLabel="Alterando...">Definir nova senha</SubmitButton>
    </form>
  );
}
