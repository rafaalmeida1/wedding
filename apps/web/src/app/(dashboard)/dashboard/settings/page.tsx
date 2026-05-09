import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/actions/auth';
import { SettingsForm } from './SettingsForm';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <p className="label-eyebrow">Conta</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">Configurações</h1>
      </header>
      <div className="card-soft">
        <SettingsForm
          initialName={user.name}
          initialUsername={user.username}
          initialAvatarUrl={user.avatarUrl}
        />
      </div>
    </div>
  );
}
