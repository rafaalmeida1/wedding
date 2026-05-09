'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SubmitButtonProps {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}

export function SubmitButton({ children, className, pendingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn('btn-primary w-full', className)}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {pendingLabel ?? 'Aguarde...'}
        </>
      ) : (
        children
      )}
    </button>
  );
}
