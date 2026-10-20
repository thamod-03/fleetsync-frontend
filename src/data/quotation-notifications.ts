import type { QuotationNotificationService } from '../services/quotation-notifications.ts'

// Local notification only. A future backend adapter owns actual email delivery.
export const localQuotationNotifications: QuotationNotificationService = {
  prepare: (quotation) => ({ message: `A fare quotation is available for order ${quotation.orderId}.`, emailDelivered: false }),
}
