import type { Notification } from '../types/domain.ts'

export interface MessageNotificationService {
  prepare(recipientIds: readonly string[], message: string, createdAt: string): Notification[]
}
