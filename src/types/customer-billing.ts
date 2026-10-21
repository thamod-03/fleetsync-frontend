import { z } from 'zod'
import type { FareQuotation, Payment } from './domain.ts'
import type { OrderDetails } from './coordinator.ts'

export const quotationDecisionSchema = z.object({ quotationId: z.string().min(1), requestId: z.uuid(), decision: z.enum(['Accepted', 'Declined']) })
export const paymentInputSchema = z.object({ quotationId: z.string().min(1), requestId: z.uuid(), method: z.literal('Card'), confirmed: z.literal(true, { error: 'Confirm the payment to continue.' }) })
export type QuotationDecisionInput = z.infer<typeof quotationDecisionSchema>
export type PaymentInput = z.infer<typeof paymentInputSchema>
export interface CustomerQuotation { quotation: FareQuotation; details: OrderDetails; publishedBy: string | null }
export interface CustomerPayment { payment: Payment; quotation: FareQuotation; details: OrderDetails }
export interface InvoiceAvailability { transaction: CustomerPayment; available: false; reason: string }
