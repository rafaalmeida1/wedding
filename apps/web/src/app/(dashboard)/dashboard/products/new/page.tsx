import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProductForm } from '@/components/products/ProductForm';

export default function NewProductPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/dashboard/products"
        className="inline-flex items-center gap-1 text-sm text-ink-mute hover:text-rose-600"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header>
        <p className="label-eyebrow">Novo</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">Cadastrar presente</h1>
      </header>
      <div className="card-soft">
        <ProductForm mode="create" />
      </div>
    </div>
  );
}
