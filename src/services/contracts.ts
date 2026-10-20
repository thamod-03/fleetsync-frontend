import type { LoginInput, PasswordResetInput, RecoveryInput, RegistrationInput, StaffApplicationInput } from '../features/auth/auth-schemas.ts'
import type { DemoDocument, User, WebRole } from '../types/domain.ts'
import type { CoordinatorOverview, OrderDetails } from '../types/coordinator.ts'
import type { QuotationInput } from '../types/quotation.ts'
import type { FareQuotation } from '../types/domain.ts'

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string }
export type WebUser = User & { role: WebRole }
export type LoginResult = ServiceResult<WebUser> & { attemptsLeft?: number; lockedUntil?: number }
export interface UploadFile { name: string; size: number; type: string }
export interface ApplicationServices {
  getCoordinatorOverview(): Promise<ServiceResult<CoordinatorOverview>>
  getSubmittedOrders(): Promise<ServiceResult<OrderDetails[]>>
  getOrder(orderId: string): Promise<ServiceResult<OrderDetails>>
  saveQuotation(input: QuotationInput, publish: boolean): Promise<ServiceResult<{ quotation: FareQuotation; emailDelivered: boolean }>>
  login(input: LoginInput): Promise<LoginResult>
  logout(): Promise<void>
  requestPasswordReset(input: RecoveryInput): Promise<ServiceResult<{ message: string; delivered: boolean }>>
  resetPassword(input: PasswordResetInput): Promise<ServiceResult<{ message: string; updated: boolean }>>
  getResetContext(): { email?: string }
  registerCustomer(input: RegistrationInput): Promise<ServiceResult<{ registrationId: string }>>
  submitStaffApplication(input: StaffApplicationInput): Promise<ServiceResult<{ applicationId: string }>>
  prepareDocuments(files: readonly UploadFile[]): Promise<ServiceResult<DemoDocument[]>>
  getDashboard(): Promise<ServiceResult<{ orders: number; quotations: number; trips: number; notifications: number }>>
}
export interface ServiceAdapter {
  services: ApplicationServices
  getCurrentUser(): User | null
  getStorageNotice(): string | null
  subscribe(listener: () => void): () => void
}
