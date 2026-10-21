import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemoStore } from '../src/store/demo-store.ts'
import { createMockServices } from '../src/data/mock-services.ts'
import { createCustomerBillingServices } from '../src/data/customer-billing-services.ts'
import { createSeedData } from '../src/data/seed.ts'
import { demoDatasetSchema } from '../src/types/domain.ts'
import { paymentInputSchema, quotationDecisionSchema } from '../src/types/customer-billing.ts'
import { filterPayments, paymentStatistics } from '../src/features/customer/payment-history.ts'
import { projectReport } from '../src/data/report-services.ts'
import type { StoragePort } from '../src/lib/demo-storage.ts'
import type { PaymentProvider } from '../src/services/payment-provider.ts'
import { unavailableAdapter } from '../src/services/unavailable-adapter.ts'

const quoteInput = { orderId: 'order-002', vehicleType: 'Truck', charges: { distance: 100, load: 200, loading: 300, handling: 400, tolls: 500 }, validUntil: '2099-10-25T12:00:00Z', message: 'Recorded fare breakdown.' }
function setup() {
  const saved = new Map<string, string>()
  const storage: StoragePort = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => { saved.set(key, value) } }
  const store = createDemoStore(storage)
  store.setState({ sessionUserId: 'user-coordinator', rememberSession: true })
  return { store, storage, services: createMockServices(store, 0) }
}
async function published() {
  const context = setup()
  const result = await context.services.saveQuotation(quoteInput, true)
  assert.ok(result.ok)
  context.store.setState({ sessionUserId: 'user-customer' })
  return { ...context, id: result.data.quotation.id }
}
async function accepted() {
  const context = await published()
  assert.ok((await context.services.decideQuotation({ quotationId: context.id, decision: 'Accepted', requestId: crypto.randomUUID() })).ok)
  return context
}
const paymentInput = (quotationId: string) => ({ quotationId, requestId: crypto.randomUUID(), method: 'Card' as const, confirmed: true as const })

test('the production default exposes no quotation/payment mutation or local transaction access', async () => {
  const services = unavailableAdapter.services
  for (const result of await Promise.all([services.getCustomerQuotations(), services.getCustomerPayments(), services.getCustomerPayment('payment-001'), services.getCustomerInvoice('payment-001'), services.payQuotation(paymentInput('quotation-001')), services.decideQuotation({ quotationId: 'quotation-001', requestId: crypto.randomUUID(), decision: 'Accepted' })])) assert.equal(result.ok, false)
  assert.equal(unavailableAdapter.getCurrentUser(), null)
})

test('published quotes are owner scoped; drafts and their payments are hidden from all Customer billing queries', async () => {
  const { store, services } = setup()
  const draft = await services.saveQuotation(quoteInput, false); assert.ok(draft.ok)
  store.setState({ sessionUserId: 'user-customer' })
  assert.equal((await services.getCustomerQuotation(draft.data.quotation.id)).ok, false)
  const list = await services.getCustomerQuotations(); assert.ok(list.ok)
  assert.deepEqual(list.data.map((item) => item.quotation.id), ['quotation-001'])
  store.setState({ sessionUserId: 'user-coordinator' })
  const sent = await services.saveQuotation({ ...quoteInput, draftId: draft.data.quotation.id }, true); assert.ok(sent.ok)
  assert.ok(sent.data.quotation.publishedAt)
  assert.equal((await services.getCustomerQuotation(sent.data.quotation.id)).ok, false)
  store.setState({ sessionUserId: 'user-customer' })
  const quote = await services.getCustomerQuotation(sent.data.quotation.id); assert.ok(quote.ok)
  assert.equal(quote.data.publishedBy, 'Ravi Perera')
})

test('same-company contacts cannot read, decide, pay, list or invoice another person’s records', async () => {
  const { store, services, id } = await accepted()
  const payment = await services.payQuotation(paymentInput(id)); assert.ok(payment.ok)
  const data = store.getState().data
  store.setState({ data: { ...data, users: [...data.users, { id: 'other', name: 'Other Customer', role: 'customer', email: 'other@example.test' }], customers: [...data.customers, { id: 'other-profile', userId: 'other', companyId: 'company-harbor' }] }, sessionUserId: 'other' })
  for (const result of await Promise.all([services.getCustomerQuotation(id), services.getCustomerPayment(payment.data.id), services.getCustomerInvoice(payment.data.id), services.decideQuotation({ quotationId: id, requestId: crypto.randomUUID(), decision: 'Declined' }), services.payQuotation(paymentInput(id))])) assert.equal(result.ok, false)
  const list = await services.getCustomerPayments(); assert.ok(list.ok); assert.equal(list.data.length, 0)
})

test('acceptance persists one decision/audit/notice set; duplicate retries succeed and stale conflicting decisions fail', async () => {
  const { services, store, id } = await published()
  const input = { quotationId: id, requestId: crypto.randomUUID(), decision: 'Accepted' as const }
  const before = store.getState().data.notifications.length
  const results = await Promise.all([services.decideQuotation(input), services.decideQuotation(input), services.decideQuotation({ ...input, requestId: crypto.randomUUID(), decision: 'Declined' })])
  assert.ok(results[0].ok && results[1].ok); assert.equal(results[2].ok, false)
  assert.equal(store.getState().data.notifications.length, before + 1)
  assert.equal(store.getState().data.auditEvents.filter((event) => event.action === 'Quotation accepted').length, 1)
  assert.equal(store.getState().data.orders.find((order) => order.id === 'order-002')?.status, 'Accepted')
  assert.equal((await services.decideQuotation({ ...input, requestId: crypto.randomUUID() })).ok, false)
  store.setState({ sessionUserId: 'user-coordinator' })
  const review = await services.getOrder('order-002'); assert.ok(review.ok); assert.equal(review.data.quotations[0].status, 'Accepted')
})

test('decline is saved cross-role and prevents payment; Pending quotes cannot be paid', async () => {
  const { services, store, id } = await published()
  assert.equal((await services.payQuotation(paymentInput(id))).ok, false)
  assert.ok((await services.decideQuotation({ quotationId: id, decision: 'Declined', requestId: crypto.randomUUID() })).ok)
  assert.equal((await services.payQuotation(paymentInput(id))).ok, false)
  store.setState({ sessionUserId: 'user-coordinator' })
  const review = await services.getOrder('order-002'); assert.ok(review.ok)
  assert.equal(review.data.order.status, 'Declined'); assert.equal(review.data.quotations[0].status, 'Declined')
})

test('validation requires confirmation and permits no sensitive payment data contract', () => {
  const input = paymentInput('quotation-001')
  assert.equal(paymentInputSchema.safeParse({ ...input, confirmed: false }).success, false)
  assert.equal(paymentInputSchema.safeParse({ ...input, method: 'Bank transfer' }).success, false)
  assert.equal(quotationDecisionSchema.safeParse({ quotationId: '', requestId: 'bad', decision: 'Accepted' }).success, false)
  const parsed = paymentInputSchema.parse({ ...input, cardNumber: 'synthetic-marker', cvv: 'synthetic-marker', amount: 1 })
  assert.deepEqual(parsed, input)
})

test('concurrent submissions process once; amounts and ownership come from the accepted quote; refresh does not pay again', async () => {
  const { store, storage, services, id } = await accepted()
  let calls = 0
  const provider: PaymentProvider = { async process({ paymentId }) { calls++; await new Promise((resolve) => setTimeout(resolve, 10)); return { status: 'Succeeded', reference: `LOCAL-${paymentId}` } } }
  const billing = createCustomerBillingServices(store, 0, provider)
  const before = store.getState().data.notifications.length
  const input = paymentInput(id)
  const results = await Promise.all([billing.payQuotation(input), billing.payQuotation(input), billing.payQuotation(paymentInput(id))])
  assert.ok(results.every((result) => result.ok)); assert.equal(calls, 1)
  const saved = results[0]; assert.ok(saved.ok)
  assert.equal(saved.data.amount, 1500); assert.equal(saved.data.customerId, 'customer-maya'); assert.equal(saved.data.orderId, 'order-002')
  assert.equal(store.getState().data.payments.filter((payment) => payment.quotationId === id).length, 1)
  assert.equal(store.getState().data.notifications.length, before + 2)
  const noticeCount = store.getState().data.notifications.length
  for (let i = 0; i < 2; i++) { assert.ok((await services.getCustomerPayment(saved.data.id)).ok); assert.ok((await services.getCustomerPayments()).ok) }
  assert.equal(store.getState().data.notifications.length, noticeCount)
  const restored = createDemoStore(storage); assert.equal(restored.getState().storageNotice, null)
  const replay = await createMockServices(restored, 0).payQuotation(paymentInput(id)); assert.ok(replay.ok)
  assert.equal(replay.data.id, saved.data.id)
  assert.ok(demoDatasetSchema.safeParse(restored.getState().data).success)
})

test('failed attempts persist without paid state, identical retries are idempotent and a new attempt can succeed', async () => {
  const { store, services, id } = await accepted()
  const billing = createCustomerBillingServices(store, 0, { async process() { return { status: 'Failed', reference: 'LOCAL-FAILED', failureReason: 'Local attempt failed.' } } })
  const input = paymentInput(id)
  const failed = await billing.payQuotation(input); assert.ok(failed.ok); assert.equal(failed.data.status, 'Failed')
  assert.equal((await services.getCustomerInvoice(failed.data.id)).ok, false)
  assert.ok((await billing.payQuotation(input)).ok)
  assert.equal(store.getState().data.payments.filter((payment) => payment.quotationId === id).length, 1)
  const retry = await services.payQuotation(paymentInput(id)); assert.ok(retry.ok); assert.equal(retry.data.status, 'Succeeded')
  assert.notEqual(retry.data.id, failed.data.id)
  assert.equal(store.getState().data.payments.filter((payment) => payment.quotationId === id && payment.status === 'Succeeded').length, 1)
})

test('pending attempts survive reload and resume safely after provider unavailability; reset prevents late commits', async () => {
  const { store, storage, services, id } = await accepted()
  const billing = createCustomerBillingServices(store, 0, { async process() { throw new Error('provider unavailable') } })
  assert.equal((await billing.payQuotation(paymentInput(id))).ok, false)
  const pending = store.getState().data.payments.find((payment) => payment.quotationId === id); assert.equal(pending?.status, 'Pending')
  const restored = createDemoStore(storage)
  const resumed = await createMockServices(restored, 0).payQuotation(paymentInput(id)); assert.ok(resumed.ok); assert.equal(resumed.data.id, pending?.id)
  await services.resetDemoData()
  assert.deepEqual(store.getState().data, createSeedData())
  assert.equal((await services.getCustomerPayment(resumed.data.id)).ok, false)
})

test('invoice boundary requires a successful owned payment and never fabricates a tax invoice', async () => {
  const { services, id } = await accepted()
  const result = await services.payQuotation(paymentInput(id)); assert.ok(result.ok)
  const invoice = await services.getCustomerInvoice(result.data.id); assert.ok(invoice.ok)
  assert.equal(invoice.data.available, false); assert.equal(invoice.data.transaction.payment.id, result.data.id)
  assert.equal(invoice.data.transaction.quotation.id, id)
  assert.equal((await services.getCustomerInvoice('missing')).ok, false)
})

test('history filters and statistics use actual records; legacy undated records are not fabricated into periods', async () => {
  const { services, id } = await accepted(); assert.ok((await services.payQuotation(paymentInput(id))).ok)
  const payments = await services.getCustomerPayments(); assert.ok(payments.ok)
  const now = new Date()
  assert.equal(filterPayments(payments.data, 'Succeeded', 'all', 'order-002', now).length, 1)
  assert.equal(filterPayments(payments.data, 'Failed', 'all', '', now).length, 0)
  assert.equal(filterPayments(payments.data, 'all', '3', '', now).length, 1)
  const stats = paymentStatistics(payments.data, now)
  assert.equal(stats.monthlyTotal, 1500); assert.equal(stats.undated, 1)
})

test('saved payments appear in existing Coordinator order and report projections without changing trip eligibility', async () => {
  const { services, store, id } = await accepted(); const trips = structuredClone(store.getState().data.trips)
  assert.ok((await services.payQuotation(paymentInput(id))).ok)
  assert.deepEqual(store.getState().data.trips, trips)
  store.setState({ sessionUserId: 'user-coordinator' })
  const order = await services.getOrder('order-002'); assert.ok(order.ok); assert.equal(order.data.payments[0].status, 'Succeeded')
  const report = projectReport(store.getState().data, { type: 'Orders and payments', start: '2026-10-01', end: '2026-10-31', base: '', customerId: '' }, 'user-coordinator')
  assert.equal(report.rows.find((row) => row.id === 'order-002')?.cells.at(-1), '1,500')
  assert.equal(report.cards.find((card) => card.label === 'Revenue')?.value, 'LKR 25,500')
})

test('complete cross-role handoff uses a newly customer-created order, not a separate quotation/payment dataset', async () => {
  const { services, store } = setup()
  store.setState({ sessionUserId: 'user-customer' })
  const created = await services.createCustomerOrder({ requestId: crypto.randomUUID(), confirmed: true, origin: 'Colombo', pickupAddress: '14 Harbor Road', pickupDate: '2026-11-01', pickupTime: '08:00', pickupContactName: 'Maya', pickupContactPhone: '077 000 1000', destination: 'Galle', destinationAddress: '22 South Road', receiverName: 'Robin', receiverPhone: '077 000 2000', deliveryBy: '2026-11-01T16:00', cargo: 'Paper', packing: 'Cartons', palletSize: '', cargoDescription: 'Wrapped paper cartons', weightKg: 100, handling: [], customerNote: '' })
  assert.ok(created.ok)
  store.setState({ sessionUserId: 'user-coordinator' })
  const submitted = await services.getSubmittedOrders(); assert.ok(submitted.ok); assert.ok(submitted.data.some((item) => item.order.id === created.data.id))
  const sent = await services.saveQuotation({ ...quoteInput, orderId: created.data.id }, true); assert.ok(sent.ok)
  store.setState({ sessionUserId: 'user-customer' })
  assert.ok((await services.getCustomerQuotation(sent.data.quotation.id)).ok)
  assert.ok((await services.decideQuotation({ quotationId: sent.data.quotation.id, decision: 'Accepted', requestId: crypto.randomUUID() })).ok)
  const paid = await services.payQuotation(paymentInput(sent.data.quotation.id)); assert.ok(paid.ok)
  const history = await services.getCustomerPayments(); assert.ok(history.ok)
  assert.ok(history.data.some((item) => item.payment.id === paid.data.id && item.details.order.id === created.data.id))
  store.setState({ sessionUserId: 'user-coordinator' })
  const review = await services.getOrder(created.data.id); assert.ok(review.ok)
  assert.equal(review.data.order.status, 'Accepted'); assert.equal(review.data.payments[0].id, paid.data.id)
})

test('notification preparation errors do not commit quotation decisions and reset rejects an in-flight payment', async () => {
  const context = await published()
  const broken = createCustomerBillingServices(context.store, 0, undefined, { prepare() { throw new Error('notice unavailable') } })
  assert.equal((await broken.decideQuotation({ quotationId: context.id, decision: 'Accepted', requestId: crypto.randomUUID() })).ok, false)
  assert.equal(context.store.getState().data.quotations.find((quote) => quote.id === context.id)?.status, 'Pending')
  assert.ok((await context.services.decideQuotation({ quotationId: context.id, decision: 'Accepted', requestId: crypto.randomUUID() })).ok)
  let finish: (() => void) | undefined
  const payment = createCustomerBillingServices(context.store, 0, { process: ({ paymentId }) => new Promise((resolve) => { finish = () => resolve({ status: 'Succeeded', reference: paymentId }) }) }).payQuotation(paymentInput(context.id))
  while (!finish) await new Promise((resolve) => setTimeout(resolve, 1))
  await context.services.resetDemoData(); finish()
  assert.equal((await payment).ok, false); assert.deepEqual(context.store.getState().data, createSeedData())
})
