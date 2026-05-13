import type { MpPaymentResponse } from '@/server/mercadopago';
import type { PaymentStatus } from '@repo/shared/payments';

export function mapMpStatus(s: MpPaymentResponse['status']): PaymentStatus {
  switch (s) {
    case 'approved':
    case 'authorized':
      return 'approved';
    case 'pending':
    case 'in_process':
      return 'pending';
    default:
      return 'failed';
  }
}
