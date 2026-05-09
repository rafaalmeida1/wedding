'use client';

// Wrapper para inicialização singleton do Mercado Pago no client.
// `initMercadoPago` da @mercadopago/sdk-react aceita apenas uma chave por sessão;
// fazemos guard para evitar chamadas duplicadas em re-renders.

import { initMercadoPago } from '@mercadopago/sdk-react';

let initialized = false;

export function initMP(): void {
  if (initialized) return;
  const key = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
  if (!key || key.startsWith('TEST-replace')) {
    console.warn(
      '[mercadopago] NEXT_PUBLIC_MP_PUBLIC_KEY ausente — Brick não funcionará. ' +
        'Defina na raiz do monorepo em `.env` ou em `apps/web/.env.local` (TEST-xx… em sandbox). ' +
        'Reinicie o `pnpm dev` após alterar.',
    );
    return;
  }
  initMercadoPago(key, { locale: 'pt-BR' });
  initialized = true;
}
