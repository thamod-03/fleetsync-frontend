import type { DemoStore } from '../store/demo-store.ts'
import type { Payment } from '../types/domain.ts'
import { paymentInputSchema, quotationDecisionSchema } from '../types/customer-billing.ts'
import type { CustomerPayment, CustomerQuotation, InvoiceAvailability, PaymentInput, QuotationDecisionInput } from '../types/customer-billing.ts'
import type { ServiceResult } from '../services/contracts.ts'
import type { PaymentProvider } from '../services/payment-provider.ts'
import type { MessageNotificationService } from '../services/message-notifications.ts'
import { localMessageNotifications } from './message-notifications.ts'
import { localPaymentProvider } from './local-payment-provider.ts'
import { projectOrders } from './order-projections.ts'

const fail = (error: string) => ({ ok: false as const, error })
const pendingByStore = new WeakMap<DemoStore, Map<string, Promise<ServiceResult<Payment>>>>()

export function createCustomerBillingServices(store: DemoStore, delayMs: number, provider: PaymentProvider = localPaymentProvider, notices: MessageNotificationService = localMessageNotifications) {
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  const identity = () => {
    const { data, sessionUserId } = store.getState()
    const user = data.users.find((item) => item.id === sessionUserId && item.role === 'customer' && item.accountStatus !== 'Pending')
    const customer = data.customers.find((item) => item.userId === user?.id)
    return user && customer ? { user, customer } : null
  }
  const quotations = (): CustomerQuotation[] => {
    const person = identity()
    if (!person) return []
    const { data } = store.getState()
    return projectOrders(data).filter((item) => item.customer.id === person.customer.id).flatMap((item) => {
      const visible = item.quotations.filter((quote) => quote.status !== 'Draft')
      const details = { ...item, quotations: visible, payments: item.payments.filter((payment) => visible.some((quote) => quote.id === payment.quotationId)) }
      return visible.map((quotation) => {
        const publication = data.auditEvents.find((event) => event.entityId === quotation.id && event.action === 'Quotation published')
        return { quotation, details, publishedBy: data.users.find((user) => user.id === publication?.actorId)?.name ?? null }
      })
    })
  }
  const transaction = (id: string): CustomerPayment | undefined => {
    for (const item of quotations()) {
      const payment = item.details.payments.find((payment) => payment.id === id && payment.quotationId === item.quotation.id)
      if (payment) return { payment, quotation: item.quotation, details: item.details }
    }
  }
  const recipients = () => store.getState().data.users.filter((user) => user.role === 'coordinator' && user.accountStatus !== 'Pending').map((user) => user.id)
  const flights = pendingByStore.get(store) ?? new Map<string, Promise<ServiceResult<Payment>>>()
  pendingByStore.set(store, flights)

  return {
    async getCustomerQuotations(): Promise<ServiceResult<CustomerQuotation[]>> {
      await wait()
      return identity() ? { ok: true, data: structuredClone(quotations()) } : fail('Your customer account is unavailable.')
    },
    async getCustomerQuotation(id: string): Promise<ServiceResult<CustomerQuotation>> {
      await wait(); const item = quotations().find((item) => item.quotation.id === id)
      return item ? { ok: true, data: structuredClone(item) } : fail('This quotation could not be found.')
    },
    async decideQuotation(input: QuotationDecisionInput): Promise<ServiceResult<CustomerQuotation['quotation']>> {
      await wait()
      const parsed = quotationDecisionSchema.safeParse(input); const person = identity()
      if (!parsed.success || !person) return fail('Check the quotation decision and sign in again if necessary.')
      const item = quotations().find((item) => item.quotation.id === parsed.data.quotationId)
      if (!item) return fail('This quotation could not be found.')
      const { quotation } = item
      if (quotation.decisionRequestId === input.requestId && quotation.status === input.decision) return { ok: true, data: structuredClone(quotation) }
      if (quotation.status !== 'Pending') return fail('This quotation has already been decided. Refresh to see its current status.')
      const { data } = store.getState(); const createdAt = new Date().toISOString()
      const updated = { ...quotation, status: parsed.data.decision, decidedBy: person.user.id, decidedAt: createdAt, decisionRequestId: input.requestId }
      try {
        const notifications = notices.prepare(recipients(), `Quotation ${quotation.id} for ${quotation.orderId} ${input.decision.toLowerCase()}.`, createdAt)
        store.setState({ data: { ...data, quotations: data.quotations.map((quote) => quote.id === quotation.id ? updated : quote), orders: data.orders.map((order) => order.id === quotation.orderId ? { ...order, status: parsed.data.decision } : order), notifications: [...data.notifications, ...notifications], auditEvents: [...data.auditEvents, { id: `audit-${crypto.randomUUID()}`, actorId: person.user.id, entityId: quotation.id, action: `Quotation ${input.decision.toLowerCase()}`, createdAt }] } })
        return { ok: true, data: structuredClone(updated) }
      } catch { return fail('The quotation decision could not be saved. Please try again.') }
    },
    async getCustomerPayments(): Promise<ServiceResult<CustomerPayment[]>> {
      await wait()
      if (!identity()) return fail('Your customer account is unavailable.')
      const items = quotations().flatMap(({ quotation, details }) => details.payments.filter((payment) => payment.quotationId === quotation.id).map((payment) => ({ payment, quotation, details })))
      return { ok: true, data: structuredClone(items.sort((a, b) => (b.payment.createdAt ?? '').localeCompare(a.payment.createdAt ?? ''))) }
    },
    async getCustomerPayment(id: string): Promise<ServiceResult<CustomerPayment>> {
      await wait(); const item = transaction(id)
      return item ? { ok: true, data: structuredClone(item) } : fail('This payment could not be found.')
    },
    async getCustomerInvoice(id: string): Promise<ServiceResult<InvoiceAvailability>> {
      await wait(); const item = transaction(id)
      if (!item || item.payment.status !== 'Succeeded') return fail('An invoice is not available for this payment.')
      return { ok: true, data: structuredClone({ transaction: item, available: false, reason: 'Invoice generation is not available yet. Your payment record is shown below.' }) }
    },
    async payQuotation(input: PaymentInput): Promise<ServiceResult<Payment>> {
      await wait()
      const parsed = paymentInputSchema.safeParse(input); const person = identity()
      if (!parsed.success || !person) return fail('Confirm the payment and sign in to your customer account.')
      const item = quotations().find((item) => item.quotation.id === parsed.data.quotationId)
      if (!item) return fail('This quotation could not be found.')
      const { quotation } = item
      if (quotation.status !== 'Accepted') return fail('Accept this quotation before making a payment.')
      const { data } = store.getState()
      const sameRequest = data.payments.find((payment) => payment.requestId === input.requestId && payment.customerId === person.customer.id)
      if (sameRequest && sameRequest.quotationId !== quotation.id) return fail('This payment request has already been used.')
      const paid = item.details.payments.find((payment) => payment.status === 'Succeeded')
      if (paid) return { ok: true, data: structuredClone(paid) }
      if (sameRequest && sameRequest.status !== 'Pending') return { ok: true, data: structuredClone(sameRequest) }
      let payment = sameRequest ?? item.details.payments.find((payment) => payment.status === 'Pending')
      if (payment && (payment.amount !== quotation.amount || payment.quotationId !== quotation.id)) return fail('The payment details have changed. Contact the coordinator.')
      if (!payment) {
        payment = { id: `pay-${crypto.randomUUID()}`, quotationId: quotation.id, orderId: quotation.orderId, customerId: person.customer.id, requestId: input.requestId, amount: quotation.amount, currency: quotation.currency, status: 'Pending', simulated: true, method: parsed.data.method, createdAt: new Date().toISOString() }
        store.setState({ data: { ...data, payments: [...data.payments, payment] } })
      }
      const existing = flights.get(payment.id)
      if (existing) return existing
      const reservation = payment
      const operation = (async (): Promise<ServiceResult<Payment>> => {
        let outcome: Awaited<ReturnType<PaymentProvider['process']>>
        try { outcome = await provider.process({ paymentId: reservation.id, amount: reservation.amount, currency: reservation.currency }) }
        catch { return fail('Payment processing is unavailable. Your pending attempt can be resumed safely.') }
        const latest = store.getState().data
        const saved = latest.payments.find((payment) => payment.id === reservation.id)
        if (!saved || saved !== reservation) return fail('This payment changed while processing. Refresh its current status.')
        const current = latest.quotations.find((quote) => quote.id === quotation.id)
        if (current?.status !== 'Accepted' || current.amount !== saved.amount) return fail('The quotation changed while processing. Contact the coordinator.')
        const completedAt = new Date().toISOString()
        const updated: Payment = { ...saved, ...outcome, completedAt }
        try {
          const notifications = notices.prepare([person.user.id, ...recipients()], `Payment ${updated.id} for ${quotation.orderId}: ${updated.status === 'Succeeded' ? 'recorded locally' : 'local attempt failed'}.`, completedAt)
          store.setState({ data: { ...latest, payments: latest.payments.map((payment) => payment.id === saved.id ? updated : payment), notifications: [...latest.notifications, ...notifications], auditEvents: [...latest.auditEvents, { id: `audit-${crypto.randomUUID()}`, actorId: person.user.id, entityId: saved.id, action: `Payment ${updated.status === 'Succeeded' ? 'recorded locally' : 'attempt failed'}`, createdAt: completedAt }] } })
          return { ok: true, data: structuredClone(updated) }
        } catch { return fail('The payment result could not be saved. Resume the pending attempt to try again.') }
      })()
      flights.set(payment.id, operation)
      try { return await operation } finally { flights.delete(payment.id) }
    },
  }
}
