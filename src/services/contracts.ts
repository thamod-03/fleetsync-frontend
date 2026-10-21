import type { CustomerQuotation, CustomerPayment, InvoiceAvailability, InvoiceDocument, TestPaymentCard, PaymentInput, QuotationDecisionInput } from '../types/customer-billing.ts'
import type { Payment } from '../types/domain.ts'
import type { LoginInput, PasswordResetInput, RecoveryInput, RegistrationInput, StaffApplicationInput } from '../features/auth/auth-schemas.ts'
import type { DemoDocument, User, WebRole } from '../types/domain.ts'
import type { CoordinatorOverview, OrderDetails } from '../types/coordinator.ts'
import type { QuotationInput } from '../types/quotation.ts'
import type { FareQuotation } from '../types/domain.ts'
import type { Trip } from '../types/domain.ts'
import type { CreateTripInput, ResourceAvailability, TripAssignmentContext, TripAssignmentDetails } from '../types/trip-assignment.ts'
import type { CancelTripInput, CompleteTripInput, ManagedTrip, TripList } from '../types/trip-management.ts'
import type { ChatWorkspace, ComposeMailInput, ConversationView, Mailbox, MailFlag, MailMessage, SendChatInput } from '../types/communications.ts'
import type { ChatMessage } from '../types/domain.ts'
import type { OperationalReport, ReportContext, ReportExport, ReportFilters } from '../types/reporting.ts'
import type { CreateCustomerOrderInput, CustomerOrderDetails, CustomerWorkspace } from '../types/customer.ts'
import type { TransportOrder } from '../types/domain.ts'

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string }
export type WebUser = User & { role: WebRole }
export type LoginResult = ServiceResult<WebUser> & { attemptsLeft?: number; lockedUntil?: number }
export interface UploadFile { name: string; size: number; type: string }
export interface ApplicationServices {
  getNotifications(): Promise<ServiceResult<import('../types/domain.ts').Notification[]>>
  markAllNotificationsRead(): Promise<ServiceResult<null>>
  getPaymentTestCards(): Promise<ServiceResult<TestPaymentCard[]>>
  downloadCustomerInvoice(id: string): Promise<ServiceResult<InvoiceDocument>>
  getCustomerQuotations(): Promise<ServiceResult<CustomerQuotation[]>>
  getCustomerQuotation(id: string): Promise<ServiceResult<CustomerQuotation>>
  decideQuotation(input: QuotationDecisionInput): Promise<ServiceResult<FareQuotation>>
  getCustomerPayments(): Promise<ServiceResult<CustomerPayment[]>>
  getCustomerPayment(id: string): Promise<ServiceResult<CustomerPayment>>
  getCustomerInvoice(id: string): Promise<ServiceResult<InvoiceAvailability>>
  payQuotation(input: PaymentInput): Promise<ServiceResult<Payment>>
  getCustomerWorkspace(): Promise<ServiceResult<CustomerWorkspace>>
  getCustomerOrder(id: string): Promise<ServiceResult<CustomerOrderDetails>>
  createCustomerOrder(input: CreateCustomerOrderInput): Promise<ServiceResult<TransportOrder>>
  getReportContext(): Promise<ServiceResult<ReportContext>>
  generateReport(input: ReportFilters): Promise<ServiceResult<OperationalReport>>
  recordReportExport(report: OperationalReport, format: 'CSV' | 'PDF'): Promise<ServiceResult<ReportExport>>
  getChatWorkspace(): Promise<ServiceResult<ChatWorkspace>>
  getConversation(id: string): Promise<ServiceResult<ConversationView>>
  sendChatMessage(input: SendChatInput): Promise<ServiceResult<ChatMessage>>
  markConversationRead(id: string): Promise<ServiceResult<null>>
  getMailbox(): Promise<ServiceResult<Mailbox>>
  saveMail(input: ComposeMailInput, draft: boolean): Promise<ServiceResult<MailMessage>>
  setMailFlag(id: string, flag: MailFlag, enabled: boolean): Promise<ServiceResult<null>>
  getTrips(): Promise<ServiceResult<TripList>>
  getTripDetails(tripId: string): Promise<ServiceResult<ManagedTrip>>
  cancelTrip(input: CancelTripInput): Promise<ServiceResult<Trip>>
  completeTrip(input: CompleteTripInput): Promise<ServiceResult<Trip>>
  getAvailability(): Promise<ServiceResult<ResourceAvailability>>
  getTripAssignmentContext(): Promise<ServiceResult<TripAssignmentContext>>
  getAssignedTrip(tripId: string): Promise<ServiceResult<TripAssignmentDetails>>
  createTrip(input: CreateTripInput): Promise<ServiceResult<Trip>>
  requeueTripNotification(tripId: string, userId: string): Promise<ServiceResult<{ message: string }>>
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
