import type { DemoStore } from '../store/demo-store.ts'
import type { ServiceResult } from '../services/contracts.ts'
import type { Notification, Trip } from '../types/domain.ts'
import { isActiveTrip, tripInputSchema, type CreateTripInput, type ResourceAvailability, type TripAssignmentContext, type TripAssignmentDetails } from '../types/trip-assignment.ts'
import type { TripNotificationService } from '../services/trip-notifications.ts'
import { localTripNotifications } from './trip-notifications.ts'
import { projectOrders } from './order-projections.ts'

export function createTripServices(store: DemoStore, delayMs = 180, notifier: TripNotificationService = localTripNotifications) {
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  const actor = () => store.getState().data.users.find((user) => user.id === store.getState().sessionUserId && user.accountStatus !== 'Pending')
  const failure = (error: string) => ({ ok: false as const, error })
  const resources = (): ResourceAvailability => {
    const { data } = store.getState()
    const active = data.trips.filter(isActiveTrip)
    const vehicles = data.vehicles.map((vehicle) => {
      const trips = active.filter((trip) => trip.assignment.vehicleId === vehicle.id)
      return { ...vehicle, trips, selectable: vehicle.available && !vehicle.inMaintenance && !trips.length }
    })
    const staff = <T extends { id: string; available: boolean; userId: string }>(records: T[], key: 'driverId' | 'mechanicId') => records.flatMap((record) => {
      const user = data.users.find((user) => user.id === record.userId && user.accountStatus !== 'Pending')
      const trips = active.filter((trip) => trip.assignment[key] === record.id)
      return user ? [{ ...record, user, trips, selectable: record.available && !trips.length }] : []
    })
    return { vehicles, drivers: staff(data.drivers, 'driverId'), mechanics: staff(data.mechanics, 'mechanicId') }
  }
  return {
    async getAvailability(): Promise<ServiceResult<ResourceAvailability>> {
      await wait()
      if (!['admin', 'coordinator'].includes(actor()?.role ?? '')) return failure('You do not have permission to view resource availability.')
      return { ok: true, data: structuredClone(resources()) }
    },
    async getTripAssignmentContext(): Promise<ServiceResult<TripAssignmentContext>> {
      await wait()
      if (actor()?.role !== 'coordinator') return failure('Only an Operational Coordinator can assign a trip.')
      return { ok: true, data: structuredClone({ ...resources(), orders: projectOrders(store.getState().data).filter((item) => !item.trips.some(isActiveTrip)) }) }
    },
    async getAssignedTrip(tripId: string): Promise<ServiceResult<TripAssignmentDetails>> {
      await wait()
      const user = actor()
      const { data } = store.getState()
      const trip = data.trips.find((item) => item.id === tripId)
      const order = projectOrders(data).find((item) => item.order.id === trip?.orderId)
      if (!user || !trip || !order) return failure('This assignment could not be found or is not accessible.')
      const customerAccess = user.role === 'customer' && order.contact.id === user.id
      const driverAccess = user.role === 'driver' && data.drivers.some((item) => item.userId === user.id && item.id === trip.assignment.driverId)
      const mechanicAccess = user.role === 'mechanic' && data.mechanics.some((item) => item.userId === user.id && item.id === trip.assignment.mechanicId)
      if (!(user.role === 'coordinator' || customerAccess || driverAccess || mechanicAccess)) return failure('This assignment could not be found or is not accessible.')
      const vehicle = data.vehicles.find((item) => item.id === trip.assignment.vehicleId)
      const driverProfile = data.drivers.find((item) => item.id === trip.assignment.driverId)
      const mechanicProfile = data.mechanics.find((item) => item.id === trip.assignment.mechanicId)
      const driverUser = data.users.find((item) => item.id === driverProfile?.userId)
      const mechanicUser = data.users.find((item) => item.id === mechanicProfile?.userId)
      if (!vehicle || !driverProfile || !mechanicProfile || !driverUser || !mechanicUser) return failure('Assignment resource details are unavailable.')
      const driver = { ...driverProfile, user: driverUser }
      const mechanic = { ...mechanicProfile, user: mechanicUser }
      return { ok: true, data: structuredClone({ trip, order: { ...order, quotations: order.quotations.filter((quote) => user.role === 'coordinator' || quote.status !== 'Draft') }, vehicle, driver, mechanic, creator: data.users.find((item) => item.id === trip.createdBy) ?? null, notifications: data.notifications.filter((item) => item.tripId === trip.id && (user.role === 'coordinator' || item.userId === user.id)) }) }
    },
    async createTrip(input: CreateTripInput): Promise<ServiceResult<Trip>> {
      await wait()
      const user = actor()
      if (user?.role !== 'coordinator') return failure('Only an Operational Coordinator can assign a trip.')
      const parsed = tripInputSchema.safeParse(input)
      if (!parsed.success) return failure('Select an order, vehicle, driver and mechanic, and check the trip window.')
      const { orderId, assignment, scheduledStart, scheduledEnd } = parsed.data
      const { data } = store.getState()
      if (!projectOrders(data).some((item) => item.order.id === orderId)) return failure('The selected submitted order does not exist.')
      if (data.trips.some((trip) => trip.orderId === orderId && isActiveTrip(trip))) return failure('This order already has an active trip. Open the existing assignment instead.')
      const available = resources()
      if (!available.vehicles.some((item) => item.id === assignment.vehicleId && item.selectable) || !available.drivers.some((item) => item.id === assignment.driverId && item.selectable) || !available.mechanics.some((item) => item.id === assignment.mechanicId && item.selectable)) return failure('One or more resources are unavailable or already assigned. Refresh availability and choose again.')
      let sequence = data.trips.length + 1
      let tripId = `TRP-${String(sequence).padStart(4, '0')}`
      while (data.trips.some((item) => item.id === tripId)) { sequence++; tripId = `TRP-${String(sequence).padStart(4, '0')}` }
      const trip: Trip = { id: tripId, orderId, assignment, status: 'Assigned', ...(scheduledStart && scheduledEnd ? { scheduledStart, scheduledEnd } : {}), createdBy: user.id, createdAt: new Date().toISOString() }
      const recipients = [available.drivers.find((item) => item.id === assignment.driverId)!.user, available.mechanics.find((item) => item.id === assignment.mechanicId)!.user]
      let notifications: Notification[]
      try { notifications = notifier.prepareAssignment(trip, recipients) }
      catch { return failure('Unable to queue assignment notifications. Nothing was saved. Please try again.') }
      // There is no await between the final availability check and this atomic local commit.
      store.setState({ data: { ...data, trips: [...data.trips, trip],
        vehicles: data.vehicles.map((item) => item.id === assignment.vehicleId ? { ...item, available: false } : item),
        drivers: data.drivers.map((item) => item.id === assignment.driverId ? { ...item, available: false } : item),
        mechanics: data.mechanics.map((item) => item.id === assignment.mechanicId ? { ...item, available: false } : item),
        notifications: [...data.notifications, ...notifications],
        auditEvents: [...data.auditEvents, { id: `audit-${crypto.randomUUID()}`, actorId: user.id, action: 'Trip assigned', entityId: trip.id, createdAt: trip.createdAt! }],
      } })
      return { ok: true, data: structuredClone(trip) }
    },
    async requeueTripNotification(tripId: string, userId: string): Promise<ServiceResult<{ message: string }>> {
      await wait()
      if (actor()?.role !== 'coordinator') return failure('Only an Operational Coordinator can queue assignment notifications.')
      const { data } = store.getState()
      const trip = data.trips.find((item) => item.id === tripId && isActiveTrip(item))
      const recipient = data.users.find((item) => item.id === userId && (data.drivers.some((driver) => driver.userId === item.id && driver.id === trip?.assignment.driverId) || data.mechanics.some((mechanic) => mechanic.userId === item.id && mechanic.id === trip?.assignment.mechanicId)))
      if (!trip || !recipient) return failure('This active assignment or recipient could not be found.')
      try {
        const queued = notifier.prepareAssignment(trip, [recipient])
        store.setState({ data: { ...data, notifications: [...data.notifications, ...queued] } })
        return { ok: true, data: { message: 'Notification queued locally. Push delivery is unavailable; no push notification was sent.' } }
      } catch { return failure('Unable to queue the notification. Please try again.') }
    },
  }
}
