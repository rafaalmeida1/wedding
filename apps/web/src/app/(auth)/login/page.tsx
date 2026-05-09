import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/ui/AuthShell';
import { LoginForm } from './LoginForm';
import { getCurrentUser } from '@/actions/auth';

interface PageProps {
  searchParams: { reset?: string };
}

export default async function LoginPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <AuthShell
      title="Entrar"
      subtitle="Acesse seu painel para gerenciar a lista."
      footer={
        <p>
          Ainda não tem conta?{' '}
          <Link href="/register" className="text-rose-600 hover:underline">
            Crie a sua agora
          </Link>
        </p>
      }
    >
      {searchParams.reset === 'ok' ? (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Senha redefinida! Faça login com a nova senha.
        </p>
      ) : null}
      <LoginForm />
    </AuthShell>
  );
}
