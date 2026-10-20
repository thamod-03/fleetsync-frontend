import type { MessageNotificationService } from '../services/message-notifications.ts'

export const localMessageNotifications: MessageNotificationService = {
  prepare: (recipients, message, createdAt) => [...new Set(recipients)].map((userId) => ({
    id: `notification-${crypto.randomUUID()}`, userId, message, createdAt, read: false, simulated: true,
  })),
}
