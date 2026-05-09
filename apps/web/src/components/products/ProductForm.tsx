'use client';

import Image from 'next/image';
import { useFormState } from 'react-dom';
import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import {
  createProductAction,
  updateProductAction,
  type ProductFormState,
} from '@/actions/products';
import { uploadProductImage } from '@/lib/upload';
import { SubmitButton } from '@/components/forms/SubmitButton';
import { FieldError } from '@/components/forms/FieldError';
import type { OwnerProduct } from '@repo/shared';

const initialState: ProductFormState = {};

interface ProductFormProps {
  mode: 'create' | 'edit';
  product?: OwnerProduct;
}

export function ProductForm({ mode, product }: ProductFormProps) {
  const action =
    mode === 'create'
      ? createProductAction
      : updateProductAction.bind(null, product!.id);

  const [state, formAction] = useFormState(action, initialState);
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      setImageUrl(url);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[2fr_3fr]">
        <div>
          <p className="label-eyebrow">Imagem do presente</p>
          <label
            htmlFor="image-input"
            className="mt-2 flex aspect-square w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-rose-200 bg-white/70 text-center text-sm text-ink-mute transition hover:border-rose-400"
          >
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt="preview"
                width={400}
                height={400}
                className="h-full w-full object-cover"
              />
            ) : uploading ? (
              <span className="flex items-center gap-2 text-rose-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
              </span>
            ) : (
              <span className="flex flex-col items-center gap-2 px-4">
                <Upload className="h-5 w-5 text-rose-500" />
                JPG/PNG/WebP, até 8MB
              </span>
            )}
          </label>
          <input
            id="image-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <input type="hidden" name="imageUrl" value={imageUrl} />
          {uploadError ? (
            <p className="mt-2 text-xs text-rose-700">{uploadError}</p>
          ) : null}
          <FieldError errors={state.fieldErrors?.imageUrl} />
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-ink-soft" htmlFor="name">
              Nome do presente
            </label>
            <input
              id="name"
              name="name"
              required
              className="input-field mt-1"
              defaultValue={product?.name}
              placeholder="Jogo de panelas"
            />
            <FieldError errors={state.fieldErrors?.name} />
          </div>
          <div>
            <label className="text-sm text-ink-soft" htmlFor="description">
              Descrição (opcional)
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="input-field mt-1"
              defaultValue={product?.description ?? ''}
              placeholder="Conte um pouco sobre o presente..."
            />
            <FieldError errors={state.fieldErrors?.description} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-ink-soft" htmlFor="priceBRL">
                Preço (R$)
              </label>
              <input
                id="priceBRL"
                name="priceBRL"
                required
                inputMode="decimal"
                className="input-field mt-1"
                defaultValue={
                  product ? (product.priceCents / 100).toFixed(2).replace('.', ',') : ''
                }
                placeholder="248,90"
              />
              <FieldError errors={state.fieldErrors?.priceCents} />
            </div>
            <div>
              <label className="text-sm text-ink-soft" htmlFor="stock">
                Quantidade
              </label>
              <input
                id="stock"
                name="stock"
                type="number"
                min={0}
                max={1000}
                required
                className="input-field mt-1"
                defaultValue={product?.stock ?? 1}
              />
              <FieldError errors={state.fieldErrors?.stock} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <SubmitButton
          className="!w-auto"
          pendingLabel={mode === 'create' ? 'Cadastrando...' : 'Salvando...'}
        >
          {mode === 'create' ? 'Cadastrar presente' : 'Salvar alterações'}
        </SubmitButton>
      </div>
    </form>
  );
}
