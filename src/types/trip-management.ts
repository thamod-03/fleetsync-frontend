import { z } from 'zod'
import { tripStatuses, type AuditEvent } from './domain.ts'
import type { TripAssignmentDetails } from './trip-assignment.ts'
import type { tripActions } from './trip-policy.ts'

const operation = { tripId: z.string().min(1), expectedStatus: z.enum(tripStatuses) }
export const cancelTripSchema = z.object({ ...operation,
  reason: z.string().trim().min(1, 'Select a cancellation reason.').max(500),
  details: z.string().trim().max(2000).default(''),
})
export const completeTripSchema = z.object({ ...operation,
  actualReturnDate: z.iso.datetime({ message: 'Choose a valid return date and time.' }),
  finalOdometer: z.number({ error: 'Enter a valid final odometer.' }).finite('Enter a finite final odometer.').nonnegative('Enter a nonnegative final odometer.'),
})
export type CancelTripInput = z.input<typeof cancelTripSchema>
export type CompleteTripInput = z.infer<typeof completeTripSchema>
export interface ManagedTrip extends TripAssignmentDetails { activity: AuditEvent[]; actions: ReturnType<typeof tripActions> }
export interface TripList { items: ManagedTrip[]; capturedAt: string }
