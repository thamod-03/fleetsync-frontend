import type { DemoDataset } from '../types/domain.ts'
import type { ManagedTrip } from '../types/trip-management.ts'
import { tripActions } from '../types/trip-policy.ts'
import { projectOrders } from './order-projections.ts'

export function projectManagedTrips(data: DemoDataset): ManagedTrip[] {
  const orders = projectOrders(data)
  return data.trips.flatMap((trip) => {
    const order = orders.find((item) => item.order.id === trip.orderId)
    const vehicle = data.vehicles.find((item) => item.id === trip.assignment.vehicleId)
    const driverProfile = data.drivers.find((item) => item.id === trip.assignment.driverId)
    const mechanicProfile = data.mechanics.find((item) => item.id === trip.assignment.mechanicId)
    const driverUser = data.users.find((item) => item.id === driverProfile?.userId)
    const mechanicUser = data.users.find((item) => item.id === mechanicProfile?.userId)
    if (!order || !vehicle || !driverProfile || !mechanicProfile || !driverUser || !mechanicUser) return []
    return [{ trip, order, vehicle, driver: { ...driverProfile, user: driverUser }, mechanic: { ...mechanicProfile, user: mechanicUser },
      creator: data.users.find((item) => item.id === trip.createdBy) ?? null,
      notifications: data.notifications.filter((item) => item.tripId === trip.id),
      activity: data.auditEvents.filter((item) => item.entityId === trip.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt)),
      actions: tripActions(trip),
    }]
  })
}
