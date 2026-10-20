import type { DemoStore } from '../store/demo-store.ts'
import type { ServiceResult } from '../services/contracts.ts'
import type { Notification, Trip } from '../types/domain.ts'
import { cancelTripSchema, completeTripSchema, type CancelTripInput, type CompleteTripInput, type ManagedTrip, type TripList } from '../types/trip-management.ts'
import { canCancelTrip, terminalResourcePolicy } from '../types/trip-policy.ts'
import { projectManagedTrips } from './trip-projections.ts'
import type { TripLifecycleNotificationService } from '../services/trip-notifications.ts'
import { localTripNotifications } from './trip-notifications.ts'

export function createTripManagementServices(store: DemoStore, delayMs = 180, notifier: TripLifecycleNotificationService = localTripNotifications) {
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  const actor = () => store.getState().data.users.find((user) => user.id === store.getState().sessionUserId && user.role === 'coordinator' && user.accountStatus !== 'Pending')
  const failure = (error: string) => ({ ok: false as const, error })
  const commit = (trip: Trip, actorId: string, action: string) => {
    const { data } = store.getState()
    const createdAt = new Date().toISOString()
    const driver = data.drivers.find((item) => item.id === trip.assignment.driverId)
    const mechanic = data.mechanics.find((item) => item.id === trip.assignment.mechanicId)
    const customer = data.customers.find((item) => data.orders.some((order) => order.id === trip.orderId && order.customerId === item.id))
    const recipients = [...new Set([driver?.userId, mechanic?.userId, customer?.userId].filter((id): id is string => !!id))]
    let notifications: Notification[]
    try { notifications = notifier.prepareLifecycle(trip, data.users.filter((user) => recipients.includes(user.id)), `${action} · ${trip.id}`) }
    catch { return failure('Unable to queue trip notifications. Nothing was saved. Please try again.') }
    // Resource flags remain unchanged for vehicle, driver AND mechanic pending release policy.
    store.setState({ data: { ...data, trips: data.trips.map((item) => item.id === trip.id ? trip : item),
      notifications: [...data.notifications, ...notifications],
      auditEvents: [...data.auditEvents, { id: `audit-${crypto.randomUUID()}`, actorId, action: trip.status === 'Cancelled' ? `${action}: ${trip.cancellationReason}` : action, entityId: trip.id, createdAt }],
    } })
    return { ok: true as const, data: structuredClone(trip) }
  }
  return {
    async getTrips(): Promise<ServiceResult<TripList>> {
      await wait()
      if (!actor()) return failure('Only an Operational Coordinator can view trip management.')
      return { ok: true, data: structuredClone({ items: projectManagedTrips(store.getState().data), capturedAt: new Date().toISOString() }) }
    },
    async getTripDetails(tripId: string): Promise<ServiceResult<ManagedTrip>> {
      await wait()
      if (!actor()) return failure('Only an Operational Coordinator can manage trips.')
      const item = projectManagedTrips(store.getState().data).find((item) => item.trip.id === tripId)
      return item ? { ok: true, data: structuredClone(item) } : failure('This trip could not be found.')
    },
    async cancelTrip(input: CancelTripInput): Promise<ServiceResult<Trip>> {
      await wait()
      const user = actor()
      if (!user) return failure('Only an Operational Coordinator can cancel a trip.')
      const parsed = cancelTripSchema.safeParse(input)
      if (!parsed.success) return failure('Provide a cancellation reason and valid trip details.')
      const current = store.getState().data.trips.find((trip) => trip.id === parsed.data.tripId)
      if (!current) return failure('This trip could not be found.')
      if (current.status !== parsed.data.expectedStatus) return failure('The trip status has changed. Reload its details before cancelling.')
      if (!canCancelTrip(current.status)) return failure('Completed or Cancelled trips cannot be cancelled.')
      return commit({ ...current, status: 'Cancelled', cancellationReason: parsed.data.reason, cancellationDetails: parsed.data.details,
        cancelledAt: new Date().toISOString(), cancelledBy: user.id, ...terminalResourcePolicy }, user.id, 'Trip cancelled')
    },
    async completeTrip(input: CompleteTripInput): Promise<ServiceResult<Trip>> {
      await wait()
      const user = actor()
      if (!user) return failure('Only an Operational Coordinator can complete a trip.')
      const parsed = completeTripSchema.safeParse(input)
      if (!parsed.success) return failure('Provide a valid actual return time and nonnegative final odometer.')
      const current = store.getState().data.trips.find((trip) => trip.id === parsed.data.tripId)
      if (!current) return failure('This trip could not be found.')
      if (current.status !== parsed.data.expectedStatus) return failure('The trip status has changed. Reload its details before completing.')
      if (current.status !== 'In Progress') return failure('Only In Progress trips can be completed.')
      if (current.startingOdometer === undefined) return failure('The starting odometer must be recorded before completion.')
      if (parsed.data.finalOdometer < current.startingOdometer) return failure('The final odometer cannot be lower than the starting odometer.')
      if (current.actualStartAt && Date.parse(parsed.data.actualReturnDate) < Date.parse(current.actualStartAt)) return failure('Actual return time cannot be before the recorded start time.')
      return commit({ ...current, status: 'Completed', actualReturnDate: parsed.data.actualReturnDate, finalOdometer: parsed.data.finalOdometer,
        completedBy: user.id, ...terminalResourcePolicy }, user.id, 'Trip completed')
    },
  }
}
