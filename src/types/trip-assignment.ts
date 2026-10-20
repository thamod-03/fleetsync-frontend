import { z } from 'zod'
import { assignmentSchema, type Driver, type Mechanic, type Notification, type Trip, type User, type Vehicle } from './domain.ts'
import type { OrderDetails } from './coordinator.ts'

export const activeTripStatuses = ['Draft', 'Assigned', 'In Progress'] as const
export const isActiveTrip = (trip: Trip) => activeTripStatuses.some((status) => status === trip.status)
export const tripInputSchema = z.object({
  orderId: z.string().min(1, 'Select an order.'), assignment: assignmentSchema,
  scheduledStart: z.iso.datetime().optional(), scheduledEnd: z.iso.datetime().optional(),
}).superRefine((value, context) => {
  if (!!value.scheduledStart !== !!value.scheduledEnd || (value.scheduledStart && value.scheduledEnd && Date.parse(value.scheduledEnd) <= Date.parse(value.scheduledStart))) {
    context.addIssue({ code: 'custom', path: ['scheduledEnd'], message: 'Choose a return time after the start time.' })
  }
})
export type CreateTripInput = z.infer<typeof tripInputSchema>
export interface ResourceAvailability {
  vehicles: (Vehicle & { selectable: boolean; trips: Trip[] })[]
  drivers: (Driver & { user: User; selectable: boolean; trips: Trip[] })[]
  mechanics: (Mechanic & { user: User; selectable: boolean; trips: Trip[] })[]
}
export interface TripAssignmentContext extends ResourceAvailability { orders: OrderDetails[] }
export interface TripAssignmentDetails {
  trip: Trip; order: OrderDetails; vehicle: Vehicle
  driver: Driver & { user: User }; mechanic: Mechanic & { user: User }
  creator: User | null; notifications: Notification[]
}
