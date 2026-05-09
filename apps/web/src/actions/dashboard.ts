'use server';

import type { DashboardSummary, PaymentRecord } from '@repo/shared';
import { apiServer } from '@/lib/api';

export async function getSummary(): Promise<DashboardSummary> {
  const { data } = await apiServer<{ summary: DashboardSummary }>(
    '/api/dashboard/summary',
  );
  return data.summary;
}

export async function listPayments(): Promise<PaymentRecord[]> {
  const { data } = await apiServer<{ payments: PaymentRecord[] }>('/api/payments');
  return data.payments;
}
