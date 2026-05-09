'use client';

import Link from 'next/link';
import { useFormState } from 'react-dom';
import { loginAction, type AuthState } from '@/actions/auth';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { FieldError } from '@/components/forms/FieldError';

const initial: AuthState = {};

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initial);
  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}
      <div>
        <label className="text-sm text-ink-soft" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input-field mt-1"
        />
        <FieldError errors={state?.fieldErrors?.email} />
      </div>
      <div>
        <label className="text-sm text-ink-soft" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input-field mt-1"
        />
        <FieldError errors={state?.fieldErrors?.password} />
        <Link
          href="/forgot-password"
          className="mt-1 inline-block text-xs text-rose-600 hover:underline"
        >
          Esqueci a senha
        </Link>
      </div>
      <SubmitButton pendingLabel="Entrando...">Entrar</SubmitButton>
    </form>
  );
}
