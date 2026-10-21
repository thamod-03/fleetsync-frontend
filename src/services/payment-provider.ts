import type { PaymentInstrumentId } from '../types/customer-billing.ts'
export interface PaymentProvider {
  process(input: { paymentId: string; amount: number; currency: 'LKR'; instrumentId?: PaymentInstrumentId }): Promise<{ status: 'Succeeded' | 'Failed'; reference: string; failureReason?: string }>
}
