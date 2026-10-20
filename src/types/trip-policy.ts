import type { Trip, TripStatus } from './domain.ts'

// Provisional UML rule requested by the team; Figma omits In Progress.
export const cancellableTripStatuses = ['Draft', 'Assigned', 'In Progress'] as const
export const canCancelTrip = (status: TripStatus) => cancellableTripStatuses.some((allowed) => allowed === status)
export const canCompleteTrip = (trip: Trip) => trip.status === 'In Progress' && trip.startingOdometer !== undefined
export const holdsTripResources = (trip: Trip) => ['Draft', 'Assigned', 'In Progress'].includes(trip.status) || trip.resourcesHeld === true
// No approved vehicle/driver/mechanic release rules exist yet. Keep all reservations.
export const terminalResourcePolicy = { resourcesHeld: true } as const
export function tripActions(trip: Trip) {
  return { cancel: canCancelTrip(trip.status), complete: canCompleteTrip(trip), reassign: false,
    completionUnavailableReason: trip.status === 'In Progress' && trip.startingOdometer === undefined ? 'The starting odometer must be recorded before completion.' : null }
}
