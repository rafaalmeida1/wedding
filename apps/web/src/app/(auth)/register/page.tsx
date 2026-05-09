import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/ui/AuthShell';
import { RegisterForm } from './RegisterForm';
import { getCurrentUser } from '@/actions/auth';

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <AuthShell
      title="Criar lista de presentes"
      subtitle="Leva 1 minuto. Você define a URL pública abaixo."
      footer={
        <p>
          Já tem conta?{' '}
          <Link href="/login" className="text-rose-600 hover:underline">
            Entrar
          </Link>
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
