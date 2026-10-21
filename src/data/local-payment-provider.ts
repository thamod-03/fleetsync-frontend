import type { PaymentProvider } from '../services/payment-provider.ts'

// Loaded only with the gated mock adapter. No financial credentials or network requests.
let failNext = false
export function resetLocalPaymentProvider() { failNext = false }
export function failNextLocalPayment() { failNext = true }
export const localPaymentProvider: PaymentProvider = {
  async process({ paymentId }) {
    const failed = failNext
    failNext = false
    return { status: failed ? 'Failed' : 'Succeeded', reference: `LOCAL-${paymentId}`, ...(failed ? { failureReason: 'The local payment attempt could not be completed.' } : {}) }
  },
}
