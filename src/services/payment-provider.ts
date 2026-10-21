export interface PaymentProvider {
  process(input: { paymentId: string; amount: number; currency: 'LKR' }): Promise<{ status: 'Succeeded' | 'Failed'; reference: string; failureReason?: string }>
}
