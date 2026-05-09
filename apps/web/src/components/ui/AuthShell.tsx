import Link from 'next/link';
import type { ReactNode } from 'react';

interface AuthShellProps {
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, footer, children }: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-cream">
      <div className="pointer-events-none absolute inset-0 bg-rose-gold-gradient opacity-20" />
      <div className="relative mx-auto flex min-h-screen max-w-lg flex-col px-6 py-12">
        <Link href="/" className="font-serif text-xl text-ink">
          ✦ Lista de Presentes
        </Link>
        <div className="mt-12 animate-fade-in-up rounded-3xl border border-rose-100 bg-white/85 p-8 shadow-bloom backdrop-blur">
          <h1 className="font-serif text-3xl text-ink">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-ink-mute">{subtitle}</p> : null}
          <div className="mt-8">{children}</div>
        </div>
        {footer ? <div className="mt-8 text-center text-sm text-ink-mute">{footer}</div> : null}
      </div>
    </main>
  );
}
