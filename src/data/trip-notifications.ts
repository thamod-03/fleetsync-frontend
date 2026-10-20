import type { TripNotificationService } from '../services/trip-notifications.ts'

export const localTripNotifications: TripNotificationService = {
  prepareAssignment: (trip, recipients) => recipients.map((user) => ({
    id: `notification-${crypto.randomUUID()}`, tripId: trip.id, userId: user.id,
    message: `New trip assigned · ${trip.id} · order ${trip.orderId}`,
    createdAt: new Date().toISOString(), read: false, simulated: true,
    channel: 'Push', deliveryState: 'Queued locally',
  })),
}
