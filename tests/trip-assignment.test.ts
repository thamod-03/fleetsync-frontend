import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemoStore } from '../src/store/demo-store.ts'
import { createMockServices } from '../src/data/mock-services.ts'
import { createTripServices } from '../src/data/trip-services.ts'
import { createSeedData } from '../src/data/seed.ts'
import { DEMO_STORAGE_KEY, type StoragePort } from '../src/lib/demo-storage.ts'
import { demoDatasetSchema } from '../src/types/domain.ts'
import { tripInputSchema, type CreateTripInput } from '../src/types/trip-assignment.ts'
import { tripFormSchema } from '../src/features/coordinator/trip-schema.ts'

function fixture() {
  const values = new Map<string, string>()
  const storage: StoragePort = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
  const store = createDemoStore(storage)
  return { store, storage, values, services: createMockServices(store, 0) }
}
const assignment = { vehicleId: 'vehicle-2', driverId: 'driver-2', mechanicId: 'mechanic-2' }
const input: CreateTripInput = { orderId: 'order-002', assignment, scheduledStart: '2026-10-24T02:30:00Z', scheduledEnd: '2026-10-24T08:30:00Z' }

test('trip assignment saves all relationships, reservations, audit and local notices together; reload/reset preserve consistency', async () => {
  const { services, store, storage } = fixture()
  await services.signIn('coordinator')
  const before = await services.getAvailability()
  assert.ok(before.ok)
  assert.equal(before.data.vehicles.filter((item) => item.selectable).length, 1)
  const created = await services.createTrip(input)
  assert.ok(created.ok)
  assert.deepEqual(created.data.assignment, assignment)
  assert.equal(created.data.orderId, 'order-002')
  assert.equal(created.data.status, 'Assigned')
  assert.equal(created.data.scheduledStart, input.scheduledStart)
  assert.equal(store.getState().data.auditEvents.at(-1)!.entityId, created.data.id)
  const availability = await services.getAvailability()
  assert.ok(availability.ok)
  for (const collection of [availability.data.vehicles, availability.data.drivers, availability.data.mechanics]) assert.equal(collection.filter((item) => item.selectable).length, 0)
  const notices = store.getState().data.notifications.filter((item) => item.tripId === created.data.id)
  assert.equal(notices.length, 2)
  assert.deepEqual(notices.map((item) => item.userId).sort(), ['user-driver-2', 'user-mechanic-2'])
  assert.ok(notices.every((item) => item.simulated && item.deliveryState === 'Queued locally'))
  const reloaded = createMockServices(createDemoStore(storage), 0)
  const details = await reloaded.getAssignedTrip(created.data.id)
  assert.ok(details.ok)
  assert.equal(details.data.vehicle.id, assignment.vehicleId)
  assert.equal(details.data.driver.user.id, 'user-driver-2')
  assert.equal(details.data.mechanic.user.id, 'user-mechanic-2')
  assert.equal(details.data.order.customer.userId, 'user-customer')
  assert.equal(demoDatasetSchema.safeParse(store.getState().data).success, true)
  await reloaded.signIn('customer')
  assert.equal((await reloaded.getAssignedTrip(created.data.id)).ok, true)
  assert.equal((await reloaded.getAvailability()).ok, false)
  await reloaded.signIn('coordinator')
  await reloaded.resetDemoData()
  assert.deepEqual(createDemoStore(storage).getState().data, createSeedData())
})

test('missing or unknown resources, missing orders, invalid windows and unauthorized assignments never mutate data', async () => {
  const { services, store } = fixture()
  assert.equal((await services.createTrip(input)).ok, false)
  await services.signIn('customer')
  assert.equal((await services.createTrip(input)).ok, false)
  await services.signIn('coordinator')
  const initial = structuredClone(store.getState().data)
  for (const key of ['vehicleId', 'driverId', 'mechanicId'] as const) {
    for (const invalid of ['', 'unknown-resource']) assert.equal((await services.createTrip({ ...input, assignment: { ...assignment, [key]: invalid } })).ok, false)
  }
  for (const invalid of [{ ...input, orderId: '' }, { ...input, orderId: 'missing' }, { ...input, scheduledEnd: '2026-10-23T00:00:00Z' }, { ...input, scheduledStart: undefined }, { ...input, scheduledStart: 'invalid' }]) assert.equal((await services.createTrip(invalid)).ok, false)
  assert.deepEqual(store.getState().data, initial)
  assert.equal(tripInputSchema.safeParse({ orderId: input.orderId, assignment: { vehicleId: 'vehicle-2', driverId: 'driver-2' } }).success, false)
  assert.equal(tripFormSchema.safeParse({ ...input, assignment: { ...assignment, mechanicId: '' } }).success, false)
})

test('each unavailable resource and maintenance flag prevents creation independently', async () => {
  for (const collection of ['vehicles', 'drivers', 'mechanics'] as const) {
    const { services, store } = fixture()
    await services.signIn('coordinator')
    const { data } = store.getState()
    store.setState({ data: { ...data, [collection]: data[collection].map((item) => ({ ...item, available: false })) } })
    const before = structuredClone(store.getState().data)
    assert.equal((await services.createTrip(input)).ok, false)
    assert.deepEqual(store.getState().data, before)
  }
  const { services, store } = fixture()
  await services.signIn('coordinator')
  const { data } = store.getState()
  store.setState({ data: { ...data, vehicles: data.vehicles.map((item) => item.id === 'vehicle-2' ? { ...item, inMaintenance: true } : item) } })
  assert.equal((await services.createTrip(input)).ok, false)
})

test('active reservations defeat stale available flags and prevent overlapping assignments to another order', async () => {
  const { services, store } = fixture()
  await services.signIn('coordinator')
  const created = await services.createTrip(input)
  assert.ok(created.ok)
  const { data } = store.getState()
  store.setState({ data: { ...data,
    orders: [...data.orders, { ...data.orders[1]!, id: 'order-003' }],
    vehicles: data.vehicles.map((item) => ({ ...item, available: true })),
    drivers: data.drivers.map((item) => ({ ...item, available: true })),
    mechanics: data.mechanics.map((item) => ({ ...item, available: true })),
  } })
  const overlap = await services.createTrip({ ...input, orderId: 'order-003', scheduledStart: '2026-10-24T04:00:00Z' })
  assert.equal(overlap.ok, false)
  const available = await services.getAvailability()
  assert.ok(available.ok)
  assert.equal(available.data.vehicles.find((item) => item.id === 'vehicle-2')!.selectable, false)
  assert.equal(available.data.drivers.find((item) => item.id === 'driver-2')!.selectable, false)
  assert.equal(available.data.mechanics.find((item) => item.id === 'mechanic-2')!.selectable, false)
})

test('racing submissions commit once; another resource set cannot create a second active trip for the same order', async () => {
  const { services, store } = fixture()
  await services.signIn('coordinator')
  const results = await Promise.all([services.createTrip(input), services.createTrip(input)])
  assert.equal(results.filter((item) => item.ok).length, 1)
  const { data } = store.getState()
  store.setState({ data: { ...data,
    users: [...data.users, { id: 'driver-user-3', name: 'Driver Three', email: 'third-driver@fleet.example', role: 'driver' }, { id: 'mechanic-user-3', name: 'Mechanic Three', email: 'third-mechanic@fleet.example', role: 'mechanic' }],
    vehicles: [...data.vehicles, { id: 'vehicle-3', registration: 'TEST-003', description: 'Truck', available: true }],
    drivers: [...data.drivers, { id: 'driver-3', userId: 'driver-user-3', available: true }],
    mechanics: [...data.mechanics, { id: 'mechanic-3', userId: 'mechanic-user-3', available: true }],
  } })
  assert.equal((await services.createTrip({ ...input, assignment: { vehicleId: 'vehicle-3', driverId: 'driver-3', mechanicId: 'mechanic-3' } })).ok, false)
  assert.equal(store.getState().data.trips.filter((trip) => trip.orderId === input.orderId).length, 1)
})

test('concurrent different orders cannot reserve the same resources', async () => {
  const { services, store } = fixture()
  await services.signIn('coordinator')
  const { data } = store.getState()
  store.setState({ data: { ...data, orders: [...data.orders, { ...data.orders[1]!, id: 'order-003' }] } })
  const results = await Promise.all([services.createTrip(input), services.createTrip({ ...input, orderId: 'order-003' })])
  assert.equal(results.filter((item) => item.ok).length, 1)
  assert.equal(store.getState().data.trips.filter((trip) => trip.assignment.vehicleId === assignment.vehicleId).length, 1)
  assert.equal(demoDatasetSchema.safeParse(store.getState().data).success, true)
})

test('availability is rechecked at commit, and notification preparation failure commits nothing', async () => {
  const { store, services } = fixture()
  await services.signIn('coordinator')
  const delayed = createTripServices(store, 20)
  const pending = delayed.createTrip(input)
  const { data } = store.getState()
  store.setState({ data: { ...data, mechanics: data.mechanics.map((item) => ({ ...item, available: false })) } })
  assert.equal((await pending).ok, false)
  assert.equal(store.getState().data.trips.length, 1)
  const other = fixture()
  await other.services.signIn('coordinator')
  const before = structuredClone(other.store.getState().data)
  const broken = createTripServices(other.store, 0, { prepareAssignment() { throw new Error('Queue unavailable') } })
  assert.equal((await broken.createTrip(input)).ok, false)
  assert.deepEqual(other.store.getState().data, before)
})

test('legacy snapshots remain readable, assignment queries are scoped and resend never reports delivery', async () => {
  const { services, store, storage, values } = fixture()
  const legacy = createSeedData()
  legacy.vehicles.forEach((item) => { delete item.capacityTonnes; delete item.homeBase; delete item.inMaintenance })
  values.set(DEMO_STORAGE_KEY, JSON.stringify({ version: 1, data: legacy, sessionUserId: 'user-coordinator', rememberSession: true }))
  const reloaded = createDemoStore(storage)
  assert.equal(reloaded.getState().storageNotice, null)
  assert.equal(reloaded.getState().data.vehicles[1]!.capacityTonnes, undefined)
  await services.signIn('coordinator')
  const created = await services.createTrip(input)
  assert.ok(created.ok)
  const resent = await services.requeueTripNotification(created.data.id, 'user-driver-2')
  assert.ok(resent.ok)
  assert.match(resent.data.message, /no push notification was sent/)
  assert.equal((await services.requeueTripNotification(created.data.id, 'user-admin')).ok, false)
  await services.signIn('customer')
  assert.equal((await services.requeueTripNotification(created.data.id, 'user-driver-2')).ok, false)
  store.setState({ sessionUserId: 'user-driver-1' })
  assert.equal((await services.getAssignedTrip(created.data.id)).ok, false)
  store.setState({ sessionUserId: 'user-driver-2' })
  const driverView = await services.getAssignedTrip(created.data.id)
  assert.ok(driverView.ok)
  assert.ok(driverView.data.notifications.every((item) => item.userId === 'user-driver-2'))
})
