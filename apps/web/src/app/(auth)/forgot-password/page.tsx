import Link from 'next/link';
import { AuthShell } from '@/components/ui/AuthShell';
import { ForgotForm } from './ForgotForm';

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Vamos enviar um link para o seu e-mail."
      footer={
        <p>
          Lembrou a senha?{' '}
          <Link href="/login" className="text-rose-600 hover:underline">
            Entrar
          </Link>
        </p>
      }
    >
      <ForgotForm />
    </AuthShell>
  );
}
