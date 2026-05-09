'use client';

import { useFormState } from 'react-dom';
import { registerAction, type AuthState } from '@/actions/auth';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { FieldError } from '@/components/forms/FieldError';

const initial: AuthState = {};

export function RegisterForm() {
  const [state, formAction] = useFormState(registerAction, initial);
  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-ink-soft" htmlFor="name">
            Seu nome (do casal)
          </label>
          <input
            id="name"
            name="name"
            required
            className="input-field mt-1"
            placeholder="Ana & Pedro"
          />
          <FieldError errors={state?.fieldErrors?.name} />
        </div>
        <div>
          <label className="text-sm text-ink-soft" htmlFor="username">
            URL pública
          </label>
          <div className="mt-1 flex items-center rounded-xl border border-rose-100 bg-white/80 focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-200">
            <span className="pl-4 text-sm text-ink-mute">presentes/</span>
            <input
              id="username"
              name="username"
              required
              className="w-full bg-transparent px-2 py-3 outline-none"
              placeholder="ana-e-pedro"
            />
          </div>
          <FieldError errors={state?.fieldErrors?.username} />
        </div>
      </div>
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
          autoComplete="new-password"
          required
          minLength={8}
          className="input-field mt-1"
        />
        <FieldError errors={state?.fieldErrors?.password} />
      </div>
      <SubmitButton pendingLabel="Criando conta...">Criar minha lista</SubmitButton>
    </form>
  );
}
