import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemoStore, type DemoStore } from '../src/store/demo-store.ts'
import { createMockServices } from '../src/data/mock-services.ts'
import { createTripManagementServices } from '../src/data/trip-management-services.ts'
import { createSeedData } from '../src/data/seed.ts'
import type { StoragePort } from '../src/lib/demo-storage.ts'
import { demoDatasetSchema, type Trip } from '../src/types/domain.ts'
import { canCancelTrip, tripActions } from '../src/types/trip-policy.ts'
import { filterTrips } from '../src/features/coordinator/trip-list-helpers.ts'

function fixture() {
  const values = new Map<string, string>()
  const storage: StoragePort = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
  const store = createDemoStore(storage)
  return { store, storage, services: createMockServices(store, 0) }
}
function progress(store: DemoStore, extra: { startingOdometer?: number; actualStartAt?: string } = { startingOdometer: 1000, actualStartAt: '2026-10-20T03:00:00Z' }) {
  const { data } = store.getState()
  store.setState({ data: { ...data, trips: data.trips.map((trip) => trip.id === 'trip-001' ? { ...trip, status: 'In Progress', ...extra } : trip) } })
}
const completion = { tripId: 'trip-001', expectedStatus: 'In Progress' as const, actualReturnDate: '2026-10-20T06:00:00Z', finalOdometer: 1200 }

test('trip list/details retrieval uses shared assignments, permission checks and all status filters', async () => {
  const { services } = fixture()
  assert.equal((await services.getTrips()).ok, false)
  await services.signIn('customer')
  assert.equal((await services.getTripDetails('trip-001')).ok, false)
  await services.signIn('coordinator')
  const listed = await services.getTrips()
  assert.ok(listed.ok)
  assert.equal(listed.data.items.length, 1)
  const item = listed.data.items[0]!
  assert.equal(item.order.order.id, 'order-001')
  assert.equal(item.mechanic.id, item.trip.assignment.mechanicId)
  for (const status of ['Draft', 'Assigned', 'In Progress', 'Completed', 'Cancelled'] as const) {
    const trip: Trip = status === 'Completed' ? { ...item.trip, status, actualReturnDate: completion.actualReturnDate, finalOdometer: 1200 } : { ...item.trip, status }
    assert.equal(filterTrips([{ ...item, trip }], { status, search: 'HARBOR', sort: 'time' }).length, 1)
    assert.equal(filterTrips([{ ...item, trip }], { status, search: 'missing', sort: 'id' }).length, 0)
  }
  const details = await services.getTripDetails(item.trip.id)
  assert.ok(details.ok)
  assert.equal(details.data.trip.status, 'Assigned')
  assert.equal(details.data.actions.cancel, true)
  assert.equal(details.data.actions.reassign, false)
  assert.equal((await services.getTripDetails('missing')).ok, false)
})

test('cancellation requires a reason and provisionally allows Draft, Assigned and In Progress', async () => {
  for (const status of ['Draft', 'Assigned', 'In Progress'] as const) {
    const { services, store } = fixture()
    await services.signIn('coordinator')
    const { data } = store.getState()
    store.setState({ data: { ...data, trips: data.trips.map((trip) => ({ ...trip, status })) } })
    const before = structuredClone(store.getState().data)
    assert.equal((await services.cancelTrip({ tripId: 'trip-001', expectedStatus: status, reason: '  ' })).ok, false)
    assert.deepEqual(store.getState().data, before)
    const result = await services.cancelTrip({ tripId: 'trip-001', expectedStatus: status, reason: ' Vehicle breakdown ', details: 'Unable to continue safely.' })
    assert.ok(result.ok)
    assert.equal(result.data.status, 'Cancelled')
    assert.equal(result.data.cancellationReason, 'Vehicle breakdown')
    assert.equal(result.data.resourcesHeld, true)
    assert.ok(store.getState().data.auditEvents.at(-1)!.action.includes('Vehicle breakdown'))
    assert.equal(store.getState().data.notifications.filter((item) => item.tripId === 'trip-001').length, 3)
    assert.equal(demoDatasetSchema.safeParse(store.getState().data).success, true)
  }
})

test('terminal, stale and concurrent cancellations cannot overwrite the committed decision', async () => {
  const { services, store } = fixture()
  await services.signIn('coordinator')
  const results = await Promise.all([
    services.cancelTrip({ tripId: 'trip-001', expectedStatus: 'Assigned', reason: 'First reason' }),
    services.cancelTrip({ tripId: 'trip-001', expectedStatus: 'Assigned', reason: 'Other reason' }),
  ])
  assert.equal(results.filter((result) => result.ok).length, 1)
  assert.equal(store.getState().data.auditEvents.length, 2)
  const before = structuredClone(store.getState().data)
  assert.equal((await services.cancelTrip({ tripId: 'trip-001', expectedStatus: 'Cancelled', reason: 'Again' })).ok, false)
  assert.equal((await services.completeTrip({ ...completion, expectedStatus: 'Cancelled' })).ok, false)
  assert.deepEqual(store.getState().data, before)
  const other = fixture()
  await other.services.signIn('coordinator')
  progress(other.store)
  assert.equal((await other.services.cancelTrip({ tripId: 'trip-001', expectedStatus: 'Assigned', reason: 'Stale' })).ok, false)
  const completed = await other.services.completeTrip(completion)
  assert.ok(completed.ok)
  assert.equal((await other.services.cancelTrip({ tripId: 'trip-001', expectedStatus: 'Completed', reason: 'Terminal' })).ok, false)
})

test('completion requires In Progress, return time and an odometer at least equal to the recorded start', async () => {
  const { services, store } = fixture()
  await services.signIn('coordinator')
  assert.equal((await services.completeTrip({ ...completion, expectedStatus: 'Assigned' })).ok, false)
  const draftData = store.getState().data
  store.setState({ data: { ...draftData, trips: draftData.trips.map((trip) => ({ ...trip, status: 'Draft' })) } })
  assert.equal((await services.completeTrip({ ...completion, expectedStatus: 'Draft' })).ok, false)
  progress(store)
  for (const invalid of [
    { ...completion, finalOdometer: -1 }, { ...completion, finalOdometer: 999 }, { ...completion, finalOdometer: NaN },
    { ...completion, finalOdometer: Infinity }, { ...completion, actualReturnDate: '' },
    { ...completion, actualReturnDate: '2026-10-20T02:00:00Z' },
  ]) assert.equal((await services.completeTrip(invalid)).ok, false)
  const result = await services.completeTrip({ ...completion, finalOdometer: 1000 })
  assert.ok(result.ok)
  assert.equal(result.data.status, 'Completed')
  if (result.data.status === 'Completed') {
    assert.equal(result.data.actualReturnDate, completion.actualReturnDate)
    assert.equal(result.data.finalOdometer, 1000)
  }
  assert.equal(result.data.resourcesHeld, true)
  assert.equal(demoDatasetSchema.safeParse(store.getState().data).success, true)
  assert.equal((await services.completeTrip({ ...completion, expectedStatus: 'Completed' })).ok, false)
  const missing = fixture()
  await missing.services.signIn('coordinator')
  progress(missing.store, {})
  assert.equal((await missing.services.completeTrip(completion)).ok, false)
  assert.equal(tripActions(missing.store.getState().data.trips[0]!).complete, false)
})

test('completion/cancellation race commits a single terminal transition using latest saved state', async () => {
  const { services, store } = fixture()
  await services.signIn('coordinator')
  progress(store)
  const results = await Promise.all([services.completeTrip(completion), services.cancelTrip({ tripId: 'trip-001', expectedStatus: 'In Progress', reason: 'Concurrent cancellation' })])
  assert.equal(results.filter((result) => result.ok).length, 1)
  assert.equal(store.getState().data.auditEvents.length, 2)
  assert.ok(['Completed', 'Cancelled'].includes(store.getState().data.trips[0]!.status))
})

test('all three reservations remain held after terminal transitions, including against stale availability flags', async () => {
  for (const action of ['cancel', 'complete'] as const) {
    const { services, store } = fixture()
    await services.signIn('coordinator')
    progress(store)
    const before = structuredClone(store.getState().data)
    const result = action === 'cancel' ? await services.cancelTrip({ tripId: 'trip-001', expectedStatus: 'In Progress', reason: 'Cancelled' }) : await services.completeTrip(completion)
    assert.ok(result.ok)
    assert.deepEqual(store.getState().data.vehicles, before.vehicles)
    assert.deepEqual(store.getState().data.drivers, before.drivers)
    assert.deepEqual(store.getState().data.mechanics, before.mechanics)
    const { data } = store.getState()
    store.setState({ data: { ...data, vehicles: data.vehicles.map((item) => ({ ...item, available: true })), drivers: data.drivers.map((item) => ({ ...item, available: true })), mechanics: data.mechanics.map((item) => ({ ...item, available: true })) } })
    const available = await services.getAvailability()
    assert.ok(available.ok)
    assert.equal(available.data.vehicles[0]!.selectable, false)
    assert.equal(available.data.drivers[0]!.selectable, false)
    assert.equal(available.data.mechanics[0]!.selectable, false)
    assert.equal((await services.createTrip({ orderId: 'order-002', assignment: { vehicleId: 'vehicle-1', driverId: 'driver-1', mechanicId: 'mechanic-1' } })).ok, false)
  }
})

test('lifecycle persistence/reset, notification failure atomicity and mutation permissions remain safe', async () => {
  const { services, store, storage } = fixture()
  await services.signIn('coordinator')
  progress(store)
  const before = structuredClone(store.getState().data)
  const broken = createTripManagementServices(store, 0, { prepareLifecycle() { throw new Error('Unavailable queue') } })
  assert.equal((await broken.completeTrip(completion)).ok, false)
  assert.deepEqual(store.getState().data, before)
  assert.equal((await services.completeTrip(completion)).ok, true)
  const reloaded = createMockServices(createDemoStore(storage), 0)
  const item = await reloaded.getTripDetails('trip-001')
  assert.ok(item.ok)
  assert.equal(item.data.trip.status, 'Completed')
  assert.ok(item.data.activity.some((event) => event.action === 'Trip completed'))
  const cancelledFixture = fixture()
  await cancelledFixture.services.signIn('coordinator')
  await cancelledFixture.services.cancelTrip({ tripId: 'trip-001', expectedStatus: 'Assigned', reason: 'Persisted reason' })
  assert.equal(createDemoStore(cancelledFixture.storage).getState().data.trips[0]!.cancellationReason, 'Persisted reason')
  await reloaded.signIn('customer')
  assert.equal((await reloaded.cancelTrip({ tripId: 'trip-001', expectedStatus: 'Completed', reason: 'No permission' })).ok, false)
  assert.equal((await reloaded.completeTrip(completion)).ok, false)
  await reloaded.signIn('coordinator')
  await reloaded.resetDemoData()
  assert.deepEqual(createDemoStore(storage).getState().data, createSeedData())
  assert.equal(canCancelTrip('In Progress'), true)
  assert.equal(canCancelTrip('Completed'), false)
})
