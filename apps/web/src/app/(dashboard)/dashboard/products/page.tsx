import Link from 'next/link';
import Image from 'next/image';
import { Plus, Pencil } from 'lucide-react';
import { listOwnerProducts, deleteProductAction } from '@/actions/products';
import { formatBRL } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const products = await listOwnerProducts();
  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="label-eyebrow">Catálogo</p>
          <h1 className="mt-2 font-serif text-4xl text-ink">Seus presentes</h1>
        </div>
        <Link href="/dashboard/products/new" className="btn-primary">
          <Plus className="h-4 w-4" /> Novo presente
        </Link>
      </header>

      {products.length === 0 ? (
        <div className="card-soft text-center">
          <p className="text-ink-mute">Você ainda não cadastrou presentes.</p>
          <Link href="/dashboard/products/new" className="mt-4 inline-block btn-primary">
            Cadastrar o primeiro
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => (
            <li
              key={p.id}
              className="card-soft flex flex-col gap-4 transition hover:shadow-bloom"
            >
              <div className="aspect-square overflow-hidden rounded-2xl bg-rose-50">
                <Image
                  src={p.imageUrl}
                  alt={p.name}
                  width={400}
                  height={400}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-serif text-xl text-ink">{p.name}</h3>
                <p className="text-sm text-ink-mute line-clamp-2">{p.description}</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium text-rose-600">{formatBRL(p.priceCents)}</span>
                <span
                  className={
                    p.isOutOfStock
                      ? 'text-xs font-semibold uppercase text-ink-mute'
                      : 'text-xs font-semibold uppercase text-rose-600'
                  }
                >
                  {p.isOutOfStock ? 'Esgotado' : `${p.stock} disponível${p.stock > 1 ? 'is' : ''}`}
                </span>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/dashboard/products/${p.id}/edit`}
                  className="btn-ghost flex-1 !py-2"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </Link>
                <form action={deleteProductAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="rounded-full border border-rose-200 bg-white/70 px-4 py-2 text-sm text-rose-700 transition hover:bg-rose-50"
                  >
                    Excluir
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
