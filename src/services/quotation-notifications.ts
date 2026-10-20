import type { FareQuotation, User } from '../types/domain.ts'

export interface QuotationNotificationService {
  prepare(quotation: FareQuotation, recipient: User): { message: string; emailDelivered: boolean }
}
