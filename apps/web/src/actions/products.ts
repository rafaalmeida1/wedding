'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { productCreateSchema, productUpdateSchema } from '@repo/shared/products';
import type { OwnerProduct } from '@repo/shared/products';
import { apiServer, ApiError } from '@/lib/api';

export interface ProductFormState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

function parsePriceBRL(value: FormDataEntryValue | null): number {
  if (typeof value !== 'string') return Number.NaN;
  const cleaned = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return Number.NaN;
  return Math.round(n * 100);
}

export async function createProductAction(
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const parsed = productCreateSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || null,
    priceCents: parsePriceBRL(formData.get('priceBRL')),
    imageUrl: formData.get('imageUrl'),
    stock: Number(formData.get('stock') ?? 1),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    await apiServer<{ product: OwnerProduct }>('/api/products', {
      method: 'POST',
      json: parsed.data,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: 'erro inesperado' };
  }
  revalidatePath('/dashboard/products');
  redirect('/dashboard/products');
}

export async function updateProductAction(
  id: string,
  _prev: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const parsed = productUpdateSchema.safeParse({
    name: formData.get('name') || undefined,
    description: formData.get('description') || null,
    priceCents:
      formData.get('priceBRL') != null ? parsePriceBRL(formData.get('priceBRL')) : undefined,
    imageUrl: formData.get('imageUrl') || undefined,
    stock: formData.get('stock') != null ? Number(formData.get('stock')) : undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    await apiServer<{ product: OwnerProduct }>(`/api/products/${id}`, {
      method: 'PATCH',
      json: parsed.data,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: 'erro inesperado' };
  }
  revalidatePath('/dashboard/products');
  revalidatePath(`/dashboard/products/${id}/edit`);
  redirect('/dashboard/products');
}

export async function deleteProductAction(formData: FormData) {
  const id = formData.get('id');
  if (typeof id !== 'string') return;
  try {
    await apiServer<{ ok: true }>(`/api/products/${id}`, { method: 'DELETE' });
  } catch (err) {
    if (err instanceof ApiError) throw new Error(err.message);
    throw err;
  }
  revalidatePath('/dashboard/products');
}

export async function listOwnerProducts(): Promise<OwnerProduct[]> {
  const { data } = await apiServer<{ products: OwnerProduct[] }>('/api/products');
  return data.products;
}

export async function getOwnerProduct(id: string): Promise<OwnerProduct | null> {
  try {
    const { data } = await apiServer<{ product: OwnerProduct }>(`/api/products/${id}`);
    return data.product;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
