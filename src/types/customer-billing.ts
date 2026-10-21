import { z } from 'zod'
import type { FareQuotation, Payment } from './domain.ts'
import type { OrderDetails } from './coordinator.ts'

export const quotationDecisionSchema = z.object({ quotationId: z.string().min(1), requestId: z.uuid(), decision: z.enum(['Accepted', 'Declined']) })
export const paymentInstrumentSchema = z.enum(['test-success', 'test-decline'])
export const paymentInputSchema = z.object({ quotationId: z.string().min(1), requestId: z.uuid(), method: z.literal('Card'), confirmed: z.literal(true, { error: 'Confirm the payment to continue.' }), instrumentId: paymentInstrumentSchema.optional() })
export type PaymentInstrumentId = z.infer<typeof paymentInstrumentSchema>
export interface TestPaymentCard { id: PaymentInstrumentId; label: string; name: string; number: string; expiry: string; securityCode: string; last4: string }
const digits = (value: string) => value.replace(/\s/g, '')
export const cardFormFields = z.object({ nameOnCard: z.string().trim().min(1, 'Enter the name on the test card.').max(100), cardNumber: z.string().trim().min(1, 'Enter a provided test card number.'), expiry: z.string().trim().min(1, 'Enter the test expiry date.'), securityCode: z.string().trim().min(1, 'Enter the test security code.') })
export type CardFormFields = z.infer<typeof cardFormFields>
export function matchTestCard(cards: readonly TestPaymentCard[], values: CardFormFields) {
  return cards.find((card) => digits(card.number) === digits(values.cardNumber) && digits(card.expiry) === digits(values.expiry) && card.securityCode === values.securityCode)
}
export function createCardFormSchema(cards: readonly TestPaymentCard[]) {
  return cardFormFields.superRefine((values, context) => {
    const card = cards.find((card) => digits(card.number) === digits(values.cardNumber))
    if (!card) context.addIssue({ code: 'custom', path: ['cardNumber'], message: 'Use one of the fictional test cards provided below.' })
    else {
      if (digits(card.expiry) !== digits(values.expiry)) context.addIssue({ code: 'custom', path: ['expiry'], message: 'Use the expiry date shown for this test card.' })
      if (card.securityCode !== values.securityCode) context.addIssue({ code: 'custom', path: ['securityCode'], message: 'Use the security code shown for this test card.' })
    }
  })
}
export type QuotationDecisionInput = z.infer<typeof quotationDecisionSchema>
export type PaymentInput = z.infer<typeof paymentInputSchema>
export interface CustomerQuotation { quotation: FareQuotation; details: OrderDetails; publishedBy: string | null }
export interface CustomerPayment { payment: Payment; quotation: FareQuotation; details: OrderDetails }
export interface InvoiceAvailability { transaction: CustomerPayment; available: boolean; reason: string }
export interface InvoiceDocument { filename: string; bytes: Uint8Array<ArrayBuffer> }
