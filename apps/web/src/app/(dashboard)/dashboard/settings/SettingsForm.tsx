'use client';

import { useFormState } from 'react-dom';
import { updateProfileAction, type SettingsState } from '@/actions/settings';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { FieldError } from '@/components/forms/FieldError';

const initial: SettingsState = {};

interface SettingsFormProps {
  initialUsername: string;
  initialName: string;
  initialAvatarUrl: string | null;
}

export function SettingsForm({
  initialUsername,
  initialName,
  initialAvatarUrl,
}: SettingsFormProps) {
  const [state, formAction] = useFormState(updateProfileAction, initial);
  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}
      <div>
        <label className="text-sm text-ink-soft" htmlFor="name">
          Nome do casal
        </label>
        <input
          id="name"
          name="name"
          required
          className="input-field mt-1"
          defaultValue={initialName}
        />
        <FieldError errors={state.fieldErrors?.name} />
      </div>
      <div>
        <label className="text-sm text-ink-soft" htmlFor="username">
          URL pública (username)
        </label>
        <input
          id="username"
          name="username"
          required
          className="input-field mt-1"
          defaultValue={initialUsername}
        />
        <FieldError errors={state.fieldErrors?.username} />
      </div>
      <div>
        <label className="text-sm text-ink-soft" htmlFor="avatarUrl">
          URL do avatar (opcional)
        </label>
        <input
          id="avatarUrl"
          name="avatarUrl"
          type="url"
          className="input-field mt-1"
          defaultValue={initialAvatarUrl ?? ''}
          placeholder="https://..."
        />
        <FieldError errors={state.fieldErrors?.avatarUrl} />
      </div>
      <SubmitButton pendingLabel="Salvando...">Salvar</SubmitButton>
    </form>
  );
}
