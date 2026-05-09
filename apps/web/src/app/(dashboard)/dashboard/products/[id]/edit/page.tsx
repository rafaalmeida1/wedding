import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getOwnerProduct } from '@/actions/products';
import { ProductForm } from '@/components/products/ProductForm';

interface EditProductPageProps {
  params: { id: string };
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const product = await getOwnerProduct(params.id);
  if (!product) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/dashboard/products"
        className="inline-flex items-center gap-1 text-sm text-ink-mute hover:text-rose-600"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <header>
        <p className="label-eyebrow">Editar</p>
        <h1 className="mt-2 font-serif text-4xl text-ink">{product.name}</h1>
      </header>
      <div className="card-soft">
        <ProductForm mode="edit" product={product} />
      </div>
    </div>
  );
}
