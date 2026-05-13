'use server';

import type { DashboardSummary, PaymentRecord } from '@repo/shared';
import { serverRequest } from '@/lib/server-json';

export async function getSummary(): Promise<DashboardSummary> {
  const data = await serverRequest<{ summary: DashboardSummary }>('/api/dashboard/summary');
  return data.summary;
}

export async function listPayments(): Promise<PaymentRecord[]> {
  const data = await serverRequest<{ payments: PaymentRecord[] }>('/api/payments');
  return data.payments;
}
