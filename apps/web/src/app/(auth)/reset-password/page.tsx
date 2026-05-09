import Link from 'next/link';
import { AuthShell } from '@/components/ui/AuthShell';
import { ResetForm } from './ResetForm';

interface PageProps {
  searchParams: { token?: string };
}

export default function ResetPasswordPage({ searchParams }: PageProps) {
  const token = searchParams.token;
  if (!token) {
    return (
      <AuthShell title="Link inválido" subtitle="Solicite um novo link de reset.">
        <Link href="/forgot-password" className="btn-primary inline-flex">
          Pedir novo link
        </Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Nova senha" subtitle="Defina uma senha forte com pelo menos 8 caracteres.">
      <ResetForm token={token} />
    </AuthShell>
  );
}
