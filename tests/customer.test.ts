import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemoStore } from '../src/store/demo-store.ts'
import { createMockServices } from '../src/data/mock-services.ts'
import { createSeedData } from '../src/data/seed.ts'
import { DEMO_STORAGE_KEY, type StoragePort } from '../src/lib/demo-storage.ts'
import { demoDatasetSchema } from '../src/types/domain.ts'
import { newOrderSchema, orderCargoSchema, orderReviewSchema, orderRouteSchema, type CreateCustomerOrderInput } from '../src/types/customer.ts'
import { customerOrderStatus, matchesCustomerTab } from '../src/features/customer/customer-format.ts'

const input: CreateCustomerOrderInput = {
  requestId: '7cb7b74c-160c-489a-b5b1-f0359cb648d8', pickupAddress: '14 Harbour Road', origin: 'Colombo', pickupDate: '2026-11-01', pickupTime: '08:00',
  pickupContactName: 'Maya Fernando', pickupContactPhone: '077 000 1000', destinationAddress: '22 Hill Road', destination: 'Kandy', deliveryBy: '2026-11-01T16:00',
  receiverName: 'Robin Silva', receiverPhone: '+94 77 000 2000', cargo: 'Paper cartons', packing: 'Pallets', weightKg: 1500, palletCount: 4, palletSize: '1.2 × 1.0 m',
  cargoDescription: 'Sealed paper cartons, wrapped for transport.', handling: ['Keep upright', 'Needs a covered truck'], customerNote: 'Use the loading bay.', confirmed: true,
}
function setup() {
  const values = new Map<string, string>()
  const storage: StoragePort = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
  const store = createDemoStore(storage)
  store.setState({ sessionUserId: 'user-customer', rememberSession: true })
  return { store, storage, services: createMockServices(store, 0) }
}

test('three-step schemas validate route, cargo and confirmation independently without losing other values', () => {
  assert.ok(orderRouteSchema.safeParse(input).success)
  assert.ok(orderCargoSchema.safeParse(input).success)
  assert.ok(orderReviewSchema.safeParse(input).success)
  assert.ok(newOrderSchema.safeParse(input).success)
  for (const changes of [{ pickupAddress: ' ' }, { receiverName: '' }, { pickupDate: '2026-02-30' }, { pickupTime: '25:00' }, { deliveryBy: '2026-10-31T12:00' }, { receiverPhone: 'abc' }, { deliveryBy: '2026-02-30T12:00' }]) assert.equal(orderRouteSchema.safeParse({ ...input, ...changes }).success, false)
  for (const changes of [{ weightKg: 0 }, { weightKg: Number.NaN }, { weightKg: Infinity }, { palletCount: -1 }, { palletCount: 1.5 }, { cargoDescription: ' ' }, { handling: ['Unsupported handling'] }]) assert.equal(orderCargoSchema.safeParse({ ...input, ...changes }).success, false)
  assert.equal(orderReviewSchema.safeParse({ confirmed: false }).success, false)
  assert.ok(orderCargoSchema.safeParse({ ...input, palletCount: undefined, palletSize: '' }).success)
  assert.ok(orderRouteSchema.safeParse({ ...input, deliveryBy: '2026-11-01T08:00' }).success)
  const route = orderRouteSchema.parse(input); const cargo = orderCargoSchema.parse(input)
  assert.deepEqual(newOrderSchema.parse({ ...route, ...cargo, confirmed: true }), newOrderSchema.parse(input))
})

test('customer creation saves the canonical Submitted order with person/company, contacts, units and audit links', async () => {
  const { store, services } = setup()
  const before = structuredClone(store.getState().data)
  const result = await services.createCustomerOrder({ ...input, customerId: 'forged-customer', status: 'Accepted' } as CreateCustomerOrderInput)
  assert.ok(result.ok)
  const order = result.data
  assert.equal(order.customerId, 'customer-maya')
  assert.equal(order.status, 'Submitted')
  assert.equal(order.weightTonnes, 1.5)
  assert.equal(order.pickupAddress, input.pickupAddress)
  assert.equal(order.receiverPhone, input.receiverPhone)
  assert.equal(order.cargoDescription, input.cargoDescription)
  assert.equal(order.pallets, '4 pallets (1.2 × 1.0 m)')
  assert.equal(order.handling, 'Keep upright, Needs a covered truck')
  assert.equal(order.pickupAt, new Date('2026-11-01T08:00').toISOString())
  assert.equal(order.deliveryBy, new Date(input.deliveryBy).toISOString())
  assert.equal(order.estimatedReturnAt, undefined)
  assert.equal(order.distanceKm, undefined)
  assert.equal(store.getState().data.auditEvents.at(-1)?.actorId, 'user-customer')
  assert.equal(store.getState().data.auditEvents.at(-1)?.entityId, order.id)
  assert.deepEqual(store.getState().data.customerCompanies, before.customerCompanies)
  assert.deepEqual(store.getState().data.trips, before.trips)
  assert.deepEqual(store.getState().data.quotations, before.quotations)
  assert.ok(demoDatasetSchema.safeParse(store.getState().data).success)
})

test('duplicate/concurrent retries create one order and audit event, including after reload', async () => {
  const { store, storage, services } = setup()
  const before = store.getState().data.orders.length
  const auditBefore = store.getState().data.auditEvents.length
  const results = await Promise.all([services.createCustomerOrder(input), services.createCustomerOrder(input)])
  assert.ok(results.every((result) => result.ok))
  assert.equal(store.getState().data.orders.length, before + 1)
  assert.equal(store.getState().data.auditEvents.length, auditBefore + 1)
  assert.equal(results[0].ok && results[1].ok && results[0].data.id, results[1].ok && results[1].data.id)
  const restored = createDemoStore(storage)
  const retry = await createMockServices(restored, 0).createCustomerOrder(input)
  assert.ok(retry.ok)
  assert.equal(restored.getState().data.orders.length, before + 1)
  assert.equal((await services.createCustomerOrder({ ...input, destination: 'Matara' })).ok, false)
  const different = await services.createCustomerOrder({ ...input, requestId: 'b736c063-c5f9-428e-950f-49dcba3da46b' })
  assert.ok(different.ok)
  assert.equal(store.getState().data.orders.length, before + 2)
})

test('customer-created orders appear immediately in Coordinator lists, review and overview without reseeding', async () => {
  const { services } = setup()
  const created = await services.createCustomerOrder(input)
  assert.ok(created.ok)
  await services.signIn('coordinator')
  const submitted = await services.getSubmittedOrders()
  const detail = await services.getOrder(created.data.id)
  const overview = await services.getCoordinatorOverview()
  assert.ok(submitted.ok && detail.ok && overview.ok)
  assert.ok(submitted.data.some((item) => item.order.id === created.data.id))
  assert.ok(overview.data.orders.some((item) => item.order.id === created.data.id))
  assert.equal(detail.data.company.id, 'company-harbor')
  assert.equal(detail.data.contact.id, 'user-customer')
  assert.equal(detail.data.order.pickupAddress, input.pickupAddress)
  assert.equal(detail.data.order.cargoDescription, input.cargoDescription)
  assert.equal((await services.createCustomerOrder(input)).ok, false)
})

test('customer access is person-scoped even within the same company, and URL IDs cannot grant access', async () => {
  const { store, services } = setup()
  const { data } = store.getState()
  store.setState({ data: { ...data, users: [...data.users, { id: 'user-other', name: 'Other Person', email: 'other@harbor.example', role: 'customer' }], customers: [...data.customers, { id: 'customer-other', userId: 'user-other', companyId: 'company-harbor' }], orders: [...data.orders, { ...data.orders[0]!, id: 'order-other', customerId: 'customer-other' }] } })
  const workspace = await services.getCustomerWorkspace()
  assert.ok(workspace.ok)
  assert.equal(workspace.data.orders.some((item) => item.order.id === 'order-other'), false)
  assert.equal((await services.getCustomerOrder('order-other')).ok, false)
  assert.equal((await services.getCustomerOrder('unknown')).ok, false)
  assert.equal((await services.getOrder('order-other')).ok, false)
  store.setState({ sessionUserId: 'user-other' })
  assert.equal((await services.getCustomerOrder('order-001')).ok, false)
  const other = await services.getCustomerWorkspace()
  assert.ok(other.ok)
  assert.deepEqual(other.data.orders.map((item) => item.order.id), ['order-other'])
  assert.deepEqual(other.data.trips, [])
  assert.deepEqual(other.data.notifications, [])
  await services.logout()
  assert.equal((await services.getCustomerWorkspace()).ok, false)
  assert.equal((await services.createCustomerOrder(input)).ok, false)
})

test('dashboard/list/detail statuses and quote privacy reflect the same canonical trip records', async () => {
  const { store, services } = setup()
  const { data } = store.getState()
  store.setState({ data: { ...data, quotations: [...data.quotations, { id: 'quote-private', orderId: 'order-002', amount: 99999, currency: 'LKR', status: 'Draft' }] } })
  const workspace = await services.getCustomerWorkspace()
  const detail = await services.getCustomerOrder('order-001')
  assert.ok(workspace.ok && detail.ok)
  assert.equal(customerOrderStatus(detail.data.details), 'Assigned')
  assert.equal(customerOrderStatus(workspace.data.orders.find((item) => item.order.id === 'order-001')!), 'Assigned')
  assert.deepEqual(workspace.data.orders.find((item) => item.order.id === 'order-002')?.quotations, [])
  const pending = workspace.data.orders.find((item) => item.order.id === 'order-002')!
  assert.equal(matchesCustomerTab(pending, 'Pending review'), true)
  assert.equal(matchesCustomerTab(pending, 'Completed'), false)
  const trip = data.trips[0]!
  store.setState({ data: { ...store.getState().data, trips: [{ ...trip, status: 'In Progress', actualStartAt: '2026-10-21T01:00:00Z' }] } })
  const progressing = await services.getCustomerWorkspace()
  assert.ok(progressing.ok)
  assert.equal(customerOrderStatus(progressing.data.orders.find((item) => item.order.id === 'order-001')!), 'Trip in progress')
  assert.equal(progressing.data.trips[0]?.driver?.id, 'user-driver-1')
  assert.equal(progressing.data.trips[0]?.mechanic?.id, 'user-mechanic-1')
})

test('validation and current account permissions are rechecked before an order is committed', async () => {
  const { store, services } = setup()
  const before = store.getState().data.orders.length
  assert.equal((await services.createCustomerOrder({ ...input, confirmed: false })).ok, false)
  assert.equal((await services.createCustomerOrder({ ...input, weightKg: -1 })).ok, false)
  assert.equal((await services.createCustomerOrder({ ...input, deliveryBy: '2026-10-01T08:00' })).ok, false)
  const delayed = createMockServices(store, 30)
  const pending = delayed.createCustomerOrder(input)
  store.setState({ sessionUserId: 'user-admin' })
  assert.equal((await pending).ok, false)
  assert.equal(store.getState().data.orders.length, before)
  store.setState({ sessionUserId: 'user-customer', data: { ...store.getState().data, users: store.getState().data.users.map((user) => user.id === 'user-customer' ? { ...user, accountStatus: 'Pending' } : user) } })
  assert.equal((await services.createCustomerOrder(input)).ok, false)
})

test('legacy snapshots remain compatible; new orders survive refresh and Reset restores canonical data', async () => {
  const { storage, store, services } = setup()
  const seed = createSeedData()
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ version: 1, data: seed, sessionUserId: 'user-customer' }))
  assert.equal(createDemoStore(storage).getState().storageNotice, null)
  const created = await services.createCustomerOrder(input)
  assert.ok(created.ok)
  const reloaded = createDemoStore(storage)
  assert.equal(reloaded.getState().sessionUserId, 'user-customer')
  const detail = await createMockServices(reloaded, 0).getCustomerOrder(created.data.id)
  assert.ok(detail.ok)
  assert.equal(detail.data.details.order.receiverName, input.receiverName)
  await services.resetDemoData()
  assert.deepEqual(store.getState().data, createSeedData())
  assert.deepEqual(createDemoStore(storage).getState().data, createSeedData())
})
