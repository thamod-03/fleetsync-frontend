import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemoStore } from '../src/store/demo-store.ts'
import { createMockServices } from '../src/data/mock-services.ts'
import { createSeedData } from '../src/data/seed.ts'
import { DEMO_STORAGE_KEY, type StoragePort } from '../src/lib/demo-storage.ts'
import { demoDatasetSchema, tripSchema } from '../src/types/domain.ts'
import { getAccessRedirect, getLoginDestination } from '../src/routes/access.ts'

function memoryStorage(initial?: string): StoragePort {
  const values = new Map<string, string>(initial === undefined ? [] : [[DEMO_STORAGE_KEY, initial]])
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
}
const assignment = { vehicleId: 'vehicle-2', driverId: 'driver-2', mechanicId: 'mechanic-2' }

test('empty storage seeds a valid dataset and reload preserves session and records', async () => {
  const storage = memoryStorage()
  const store = createDemoStore(storage)
  const services = createMockServices(store, 0)
  assert.deepEqual(store.getState().data, createSeedData())
  await services.signIn('coordinator')
  const created = await services.createTrip({ orderId: 'order-002', assignment })
  assert.equal(created.ok, true)
  await services.signIn('customer')
  const dashboard = await services.getDashboard()
  assert.equal(dashboard.ok && dashboard.data.trips, 2)
  const reloaded = createDemoStore(storage)
  assert.equal(reloaded.getState().sessionUserId, 'user-customer')
  assert.deepEqual(reloaded.getState().data, store.getState().data)
  assert.equal(demoDatasetSchema.safeParse(reloaded.getState().data).success, true)
  await services.logout()
  assert.equal(createDemoStore(storage).getState().sessionUserId, null)
  assert.equal(createDemoStore(storage).getState().data.trips.length, 2)
  await services.signIn('admin')
  await services.resetDemoData()
  assert.deepEqual(createDemoStore(storage).getState().data, createSeedData())
  assert.equal(createDemoStore(storage).getState().sessionUserId, 'user-admin')
})

test('invalid JSON, version, relationships and resource conflicts recover safely', () => {
  const broken = createSeedData()
  broken.orders[0]!.customerId = 'unknown'
  const conflict = createSeedData()
  conflict.trips.push({ ...conflict.trips[0]!, id: 'duplicate-assignment' })
  for (const raw of ['{', JSON.stringify({ version: 99 }), JSON.stringify({ version: 1, data: broken, sessionUserId: null }), JSON.stringify({ version: 1, data: conflict, sessionUserId: null })]) {
    const state = createDemoStore(memoryStorage(raw)).getState()
    assert.deepEqual(state.data, createSeedData())
    assert.ok(state.storageNotice)
    assert.equal(state.sessionUserId, null)
  }
})

test('stale or mobile sessions are cleared while valid shared records survive', () => {
  for (const sessionUserId of ['missing-user', 'user-driver-1']) {
    const data = createSeedData()
    data.orders[0]!.cargo = 'Edited fictional cargo'
    const state = createDemoStore(memoryStorage(JSON.stringify({ version: 1, data, sessionUserId }))).getState()
    assert.equal(state.sessionUserId, null)
    assert.equal(state.data.orders[0]!.cargo, 'Edited fictional cargo')
  }
})

test('unavailable localStorage stays usable in memory with a visible notice', async () => {
  const storage: StoragePort = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('quota') } }
  const store = createDemoStore(storage)
  await createMockServices(store, 0).signIn('customer')
  assert.equal(store.getState().sessionUserId, 'user-customer')
  assert.ok(store.getState().storageNotice)
})

test('trip creation requires a coordinator and all resources; simultaneous assignments cannot double book', async () => {
  const store = createDemoStore(memoryStorage())
  const services = createMockServices(store, 0)
  assert.equal((await services.createTrip({ orderId: 'order-002', assignment })).ok, false)
  await services.signIn('customer')
  assert.equal((await services.createTrip({ orderId: 'order-002', assignment })).ok, false)
  await services.signIn('coordinator')
  assert.equal((await services.createTrip({ orderId: 'order-002', assignment: { ...assignment, mechanicId: '' } })).ok, false)
  assert.equal((await services.createTrip({ orderId: 'missing', assignment })).ok, false)
  assert.equal((await services.createTrip({ orderId: 'order-002', assignment: { ...assignment, vehicleId: 'vehicle-1' } })).ok, false)
  const results = await Promise.all([services.createTrip({ orderId: 'order-002', assignment }), services.createTrip({ orderId: 'order-002', assignment })])
  assert.equal(results.filter((result) => result.ok).length, 1)
  assert.equal(store.getState().data.vehicles[1]!.available, false)
  assert.equal(store.getState().data.drivers[1]!.available, false)
  assert.equal(store.getState().data.mechanics[1]!.available, false)
  assert.equal(store.getState().data.auditEvents.length, 2)
})

test('completed trips require actual return date and final odometer', () => {
  const trip = { ...createSeedData().trips[0], status: 'Completed' }
  assert.equal(tripSchema.safeParse(trip).success, false)
  assert.equal(tripSchema.safeParse({ ...trip, actualReturnDate: '2026-10-20T10:00:00Z', finalOdometer: 12000 }).success, true)
})

test('role redirects preserve internal destinations and reject other roles or external return URLs', () => {
  const customer = createSeedData().users.find((user) => user.role === 'customer')!
  assert.equal(getAccessRedirect(null, 'admin', '/admin?view=summary'), '/login?from=%2Fadmin%3Fview%3Dsummary')
  assert.equal(getAccessRedirect(customer, 'admin', '/admin'), '/unauthorized')
  assert.equal(getAccessRedirect(customer, 'customer', '/customer'), null)
  assert.equal(getLoginDestination('customer', '/customer/orders?tab=all'), '/customer/orders?tab=all')
  assert.equal(getLoginDestination('customer', '/customer?view=summary'), '/customer?view=summary')
  for (const url of ['https://example.com', '//example.com', '/admin', '/customer-imposter']) assert.equal(getLoginDestination('customer', url), '/customer')
})
