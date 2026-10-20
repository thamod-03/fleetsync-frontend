import type { TripStatus } from '../../types/domain.ts'
import type { ManagedTrip } from '../../types/trip-management.ts'

export function filterTrips(items: ManagedTrip[], filters: { status: TripStatus; search: string; sort: string }) {
  const needle = filters.search.trim().toLowerCase()
  const filtered = items.filter((item) => item.trip.status === filters.status && (!needle || [item.trip.id, item.trip.orderId, item.order.company.name, item.order.order.origin, item.order.order.destination, item.vehicle.registration, item.driver.user.name, item.mechanic.user.name].some((value) => value.toLowerCase().includes(needle))))
  return [...filtered].sort((a,b) => filters.sort === 'id' ? a.trip.id.localeCompare(b.trip.id) : (a.trip.scheduledStart ?? '9999').localeCompare(b.trip.scheduledStart ?? '9999'))
}
export function tripAttention(items: ManagedTrip[], capturedAt: string) {
  return items.flatMap((item) => item.trip.status === 'Assigned' && item.trip.scheduledStart && Date.parse(item.trip.scheduledStart) < Date.parse(capturedAt) ? [{ item, title: `${item.trip.id} has not started`, description: 'The scheduled start time has passed.' }] : item.trip.status === 'In Progress' && item.trip.startingOdometer === undefined ? [{ item, title: 'Starting odometer missing', description: `${item.trip.id} needs its recorded starting odometer before completion.` }] : [])
}
