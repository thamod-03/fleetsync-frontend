import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemoStore } from '../src/store/demo-store.ts'
import { createMockServices } from '../src/data/mock-services.ts'
import { DEMO_STORAGE_KEY, type StoragePort } from '../src/lib/demo-storage.ts'
import { createCoordinatorServices } from '../src/data/coordinator-services.ts'
import { quotationInputSchema, type QuotationInput } from '../src/types/quotation.ts'
import { demoDatasetSchema } from '../src/types/domain.ts'
import { filterOrders, matchesTab, ordersCsv } from '../src/features/coordinator/coordinator-format.ts'
import { quotationFormSchema } from '../src/features/coordinator/quotation-schema.ts'

function fixture() {
  const values = new Map<string, string>()
  const storage: StoragePort = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
  const store = createDemoStore(storage)
  return { store, storage, values, services: createMockServices(store, 0) }
}

const quotation: QuotationInput = {
  orderId: 'order-002', vehicleType: 'Cargo van',
  charges: { distance: 12000, load: 2500, loading: 1000, handling: 0, tolls: 750 },
  validUntil: '2099-01-01T12:00:00Z', message: 'Collection from the loading bay.',
}

test('quotation drafts persist and update the same record without exposing them to customers', async () => {
  const { services, storage, store } = fixture()
  await services.signIn('coordinator')
  const saved = await services.saveQuotation(quotation, false)
  assert.ok(saved.ok)
  assert.equal(saved.data.quotation.status, 'Draft')
  assert.equal(saved.data.quotation.amount, 16250)
  assert.equal(saved.data.emailDelivered, false)
  assert.equal(store.getState().data.orders.find((item) => item.id === 'order-002')!.status, 'Submitted')
  const reloaded = createMockServices(createDemoStore(storage), 0)
  const retrieved = await reloaded.getOrder('order-002')
  assert.ok(retrieved.ok)
  assert.equal(retrieved.data.quotations[0]!.id, saved.data.quotation.id)
  const updated = await reloaded.saveQuotation({ ...quotation, draftId: saved.data.quotation.id, message: 'Updated draft' }, false)
  assert.ok(updated.ok)
  assert.equal(updated.data.quotation.id, saved.data.quotation.id)
  await reloaded.signIn('customer')
  const customerOrder = await reloaded.getOrder('order-002')
  assert.ok(customerOrder.ok)
  assert.deepEqual(customerOrder.data.quotations, [])
  const dashboard = await reloaded.getDashboard()
  assert.equal(dashboard.ok && dashboard.data.quotations, 1)
})

test('publishing persists the original order relationship, customer notification and quotation across roles and reload', async () => {
  const { services, store, storage } = fixture()
  await services.signIn('coordinator')
  const draft = await services.saveQuotation(quotation, false)
  assert.ok(draft.ok)
  const saved = await services.saveQuotation({ ...quotation, draftId: draft.data.quotation.id }, true)
  assert.ok(saved.ok)
  assert.equal(saved.data.quotation.id, draft.data.quotation.id)
  assert.equal(saved.data.quotation.status, 'Pending')
  assert.equal(saved.data.emailDelivered, false)
  assert.equal(store.getState().data.orders.find((item) => item.id === quotation.orderId)!.status, 'Quoted')
  assert.equal(store.getState().data.notifications.at(-1)!.userId, 'user-customer')
  assert.equal(store.getState().data.notifications.at(-1)!.simulated, true)
  assert.equal(demoDatasetSchema.safeParse(store.getState().data).success, true)
  await services.logout()
  const reloaded = createMockServices(createDemoStore(storage), 0)
  await reloaded.signIn('customer')
  const order = await reloaded.getOrder(quotation.orderId)
  assert.ok(order.ok)
  assert.equal(order.data.quotations[0]!.amount, 16250)
  assert.equal(order.data.customer.userId, 'user-customer')
  await reloaded.signIn('admin')
  await reloaded.resetDemoData()
  await reloaded.signIn('coordinator')
  const reset = await reloaded.getOrder(quotation.orderId)
  assert.ok(reset.ok)
  assert.deepEqual(reset.data.quotations, [])
})

test('invalid quotation operations do not mutate shared records; racing publication issues only once', async () => {
  const { services, store } = fixture()
  const initial = structuredClone(store.getState().data)
  assert.equal((await services.saveQuotation(quotation, true)).ok, false)
  await services.signIn('customer')
  assert.equal((await services.saveQuotation(quotation, true)).ok, false)
  await services.signIn('coordinator')
  for (const invalid of [
    { ...quotation, orderId: 'missing' }, { ...quotation, orderId: 'order-001' },
    { ...quotation, vehicleType: '' }, { ...quotation, draftId: 'stale-draft' },
    { ...quotation, validUntil: '2020-01-01T00:00:00Z' },
    { ...quotation, charges: { ...quotation.charges, load: -1 } },
    { ...quotation, charges: { ...quotation.charges, load: NaN } },
    { ...quotation, charges: { ...quotation.charges, load: Infinity } },
  ]) assert.equal((await services.saveQuotation(invalid, true)).ok, false)
  assert.deepEqual(store.getState().data, initial)
  const results = await Promise.all([services.saveQuotation(quotation, true), services.saveQuotation(quotation, true)])
  assert.equal(results.filter((result) => result.ok).length, 1)
  assert.equal(store.getState().data.quotations.filter((quote) => quote.orderId === quotation.orderId).length, 1)
  assert.equal(store.getState().data.notifications.length, initial.notifications.length + 1)
  const after = structuredClone(store.getState().data)
  assert.equal((await services.saveQuotation(quotation, false)).ok, false)
  assert.deepEqual(store.getState().data, after)
})

test('notification preparation failure leaves quotation/order/notification records unchanged', async () => {
  const { store, services } = fixture()
  await services.signIn('coordinator')
  const before = structuredClone(store.getState().data)
  const failing = createCoordinatorServices(store, 0, { prepare() { throw new Error('Notification service unavailable') } })
  const result = await failing.saveQuotation(quotation, true)
  assert.equal(result.ok, false)
  assert.deepEqual(store.getState().data, before)
})

test('reusable fare validation, order groups/search/filters and CSV export handle edge cases', async () => {
  assert.equal(quotationInputSchema.safeParse(quotation).success, true)
  assert.equal(quotationFormSchema.safeParse({ ...quotation, validUntil: 'not-a-date' }).success, false)
  assert.equal(quotationFormSchema.safeParse({ ...quotation, validUntil: '2099-01-01T18:00' }).success, true)
  const { services } = fixture()
  await services.signIn('coordinator')
  const result = await services.getSubmittedOrders()
  assert.ok(result.ok)
  const filters = { tab: 'All open' as const, search: '', pickup: '', payment: '' }
  assert.equal(filterOrders(result.data, { ...filters, search: '  kAnDy  ' }).length, 1)
  assert.equal(filterOrders(result.data, { ...filters, payment: 'Paid' }).length, 1)
  assert.equal(filterOrders(result.data, { ...filters, pickup: '2000-01-01' }).length, 0)
  assert.equal(result.data.filter((item) => matchesTab(item, 'Needs quotation')).length, 1)
  assert.equal(result.data.filter((item) => matchesTab(item, 'Closed')).length, 0)
  result.data[0]!.company.name = '=HYPERLINK("untrusted")'
  const csv = ordersCsv(result.data)
  assert.match(csv, /"'=HYPERLINK\(""untrusted""\)"/)
  const published = await services.saveQuotation(quotation, true)
  assert.ok(published.ok)
  const updated = await services.getSubmittedOrders()
  assert.ok(updated.ok)
  assert.equal(updated.data.filter((item) => matchesTab(item, 'Quoted')).length, 1)
})

test('operational queries require Coordinator access and never expose another customer order', async () => {
  const { services, store } = fixture()
  assert.equal((await services.getSubmittedOrders()).ok, false)
  assert.equal((await services.getCoordinatorOverview()).ok, false)
  await services.signIn('admin')
  assert.equal((await services.getSubmittedOrders()).ok, false)
  await services.signIn('customer')
  assert.equal((await services.getCoordinatorOverview()).ok, false)
  const own = await services.getOrder('order-001')
  assert.equal(own.ok && own.data.quotations[0]?.id, 'quotation-001')
  assert.equal((await services.getOrder('missing')).ok, false)
  const { data } = store.getState()
  store.setState({ data: { ...data,
    users: [...data.users, { id: 'other-user', name: 'Other Customer', email: 'other@customer.example', role: 'customer' }],
    customers: [...data.customers, { id: 'other-customer', userId: 'other-user', companyId: 'company-harbor' }],
    orders: [...data.orders, { ...data.orders[0]!, id: 'other-order', customerId: 'other-customer' }],
  } })
  assert.equal((await services.getOrder('other-order')).ok, false)
  await services.signIn('coordinator')
  assert.equal((await services.getOrder('other-order')).ok, true)
})

test('submitted order projections join canonical records, exclude drafts and return isolated snapshots', async () => {
  const { store, services } = fixture()
  await services.signIn('coordinator')
  const { data } = store.getState()
  store.setState({ data: { ...data, orders: [...data.orders, { ...data.orders[0]!, id: 'draft-order', status: 'Draft' }] } })
  const result = await services.getSubmittedOrders()
  assert.ok(result.ok)
  assert.deepEqual(result.data.map((item) => item.order.id), ['order-002', 'order-001'])
  assert.equal(result.data[0]!.contact.id, 'user-customer')
  assert.equal(result.data[0]!.company.id, 'company-harbor')
  assert.equal(result.data[1]!.payments[0]!.quotationId, result.data[1]!.quotations[0]!.id)
  result.data[0]!.order.cargo = 'Mutated result'
  result.data[0]!.company.name = 'Mutated result'
  assert.notEqual(store.getState().data.orders[1]!.cargo, 'Mutated result')
  assert.notEqual(store.getState().data.customerCompanies[0]!.name, 'Mutated result')
  assert.equal((await services.getOrder('draft-order')).ok, false)
})

test('dashboard reflects shared resource reservations and persisted order updates after reload', async () => {
  const { store, services, storage, values } = fixture()
  await services.signIn('coordinator')
  const before = await services.getCoordinatorOverview()
  assert.ok(before.ok)
  assert.equal(before.data.vehicles.filter((item) => item.available).length, 1)
  const created = await services.createTrip({ orderId: 'order-002', assignment: { vehicleId: 'vehicle-2', driverId: 'driver-2', mechanicId: 'mechanic-2' } })
  assert.ok(created.ok)
  const { data } = store.getState()
  store.setState({ data: { ...data, orders: data.orders.map((order) => order.id === 'order-002' ? { ...order, cargo: 'Updated customer requirements' } : order) } })
  const after = await createMockServices(createDemoStore(storage), 0).getCoordinatorOverview()
  assert.ok(after.ok)
  assert.equal(after.data.trips.length, 2)
  assert.equal(after.data.vehicles.filter((item) => item.available).length, 0)
  assert.equal(after.data.orders.find((item) => item.order.id === 'order-002')!.order.cargo, 'Updated customer requirements')
  assert.ok(values.get(DEMO_STORAGE_KEY))
  await services.resetDemoData()
  const reset = await services.getCoordinatorOverview()
  assert.ok(reset.ok)
  assert.equal(reset.data.trips.length, 1)
})
