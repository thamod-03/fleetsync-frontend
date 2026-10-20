import type { Notification, Trip, User } from '../types/domain.ts'

export interface TripNotificationService {
  prepareAssignment(trip: Trip, recipients: readonly User[]): Notification[]
}
export interface TripLifecycleNotificationService {
  prepareLifecycle(trip: Trip, recipients: readonly User[], message: string): Notification[]
}
