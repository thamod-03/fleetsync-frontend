import type { TestPaymentCard } from '../types/customer-billing.ts'

// Deliberately non-bank numbers (zero issuer prefix). Never substitute real card data.
export const testPaymentCards: readonly TestPaymentCard[] = [
  { id: 'test-success', label: 'Successful payment', name: 'MAYA TEST', number: '0000 0000 0000 4421', expiry: '12 / 30', securityCode: '123', last4: '4421' },
  { id: 'test-decline', label: 'Unsuccessful payment', name: 'MAYA TEST', number: '0000 0000 0000 0002', expiry: '12 / 30', securityCode: '999', last4: '0002' },
]
