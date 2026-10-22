import { unavailableAdapter } from './unavailable-adapter.ts'
import type { ApplicationServices } from './contracts.ts'

let adapter = unavailableAdapter
let revision = 0
const listeners = new Set<() => void>()
const notify = () => { revision++; listeners.forEach((listener) => listener()) }

// Both gates are compiled by Vite; runtime flags, URLs and storage cannot enable mocks.
// Preview shares the existing adapter, but never enables the local developer tools route.
const initialization = (import.meta.env.DEV && __FLEETSYNC_LOCAL_DEV__) || __FLEETSYNC_STAGING__
  ? import('../development/service-adapter').then(({ developmentAdapter }) => {
    adapter = developmentAdapter
    adapter.subscribe(notify)
    notify()
  })
  : Promise.resolve()

export const initializeApplicationServices = () => initialization
export const getCurrentUser = () => adapter.getCurrentUser()
export const getStorageNotice = () => adapter.getStorageNotice()
export const getApplicationRevision = () => revision
export const subscribeApplication = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const applicationServices: ApplicationServices = {
  getAdminWorkspace: async () => { await initialization; return adapter.services.getAdminWorkspace() },
  getAdminUser: async (input) => { await initialization; return adapter.services.getAdminUser(input) },
  getAdminApplication: async (input) => { await initialization; return adapter.services.getAdminApplication(input) },
  saveApplicationNote: async (input) => { await initialization; return adapter.services.saveApplicationNote(input) },
  decideStaffApplication: async (input) => { await initialization; return adapter.services.decideStaffApplication(input) },
  getNotifications: async () => { await initialization; return adapter.services.getNotifications() },
  markAllNotificationsRead: async () => { await initialization; return adapter.services.markAllNotificationsRead() },
  getPaymentTestCards: async () => { await initialization; return adapter.services.getPaymentTestCards() },
  downloadCustomerInvoice: async (id) => { await initialization; return adapter.services.downloadCustomerInvoice(id) },
  getCustomerQuotations: async () => { await initialization; return adapter.services.getCustomerQuotations() },
  getCustomerQuotation: async (id) => { await initialization; return adapter.services.getCustomerQuotation(id) },
  decideQuotation: async (input) => { await initialization; return adapter.services.decideQuotation(input) },
  getCustomerPayments: async () => { await initialization; return adapter.services.getCustomerPayments() },
  getCustomerPayment: async (id) => { await initialization; return adapter.services.getCustomerPayment(id) },
  getCustomerInvoice: async (id) => { await initialization; return adapter.services.getCustomerInvoice(id) },
  payQuotation: async (input) => { await initialization; return adapter.services.payQuotation(input) },

  getCustomerWorkspace: async () => { await initialization; return adapter.services.getCustomerWorkspace() },
  getCustomerOrder: async (id) => { await initialization; return adapter.services.getCustomerOrder(id) },
  createCustomerOrder: async (input) => { await initialization; return adapter.services.createCustomerOrder(input) },
  getReportContext: async () => { await initialization; return adapter.services.getReportContext() },
  generateReport: async (input) => { await initialization; return adapter.services.generateReport(input) },
  recordReportExport: async (report, format) => { await initialization; return adapter.services.recordReportExport(report, format) },
  getChatWorkspace: async () => { await initialization; return adapter.services.getChatWorkspace() },
  getConversation: async (id) => { await initialization; return adapter.services.getConversation(id) },
  sendChatMessage: async (input) => { await initialization; return adapter.services.sendChatMessage(input) },
  markConversationRead: async (id) => { await initialization; return adapter.services.markConversationRead(id) },
  getMailbox: async () => { await initialization; return adapter.services.getMailbox() },
  saveMail: async (input, draft) => { await initialization; return adapter.services.saveMail(input, draft) },
  setMailFlag: async (id, flag, enabled) => { await initialization; return adapter.services.setMailFlag(id, flag, enabled) },
  getTrips: async () => { await initialization; return adapter.services.getTrips() },
  getTripDetails: async (id) => { await initialization; return adapter.services.getTripDetails(id) },
  cancelTrip: async (input) => { await initialization; return adapter.services.cancelTrip(input) },
  completeTrip: async (input) => { await initialization; return adapter.services.completeTrip(input) },
  getAvailability: async () => { await initialization; return adapter.services.getAvailability() },
  getTripAssignmentContext: async () => { await initialization; return adapter.services.getTripAssignmentContext() },
  getAssignedTrip: async (id) => { await initialization; return adapter.services.getAssignedTrip(id) },
  createTrip: async (input) => { await initialization; return adapter.services.createTrip(input) },
  requeueTripNotification: async (tripId, userId) => { await initialization; return adapter.services.requeueTripNotification(tripId, userId) },
  getCoordinatorOverview: async () => { await initialization; return adapter.services.getCoordinatorOverview() },
  getSubmittedOrders: async () => { await initialization; return adapter.services.getSubmittedOrders() },
  getOrder: async (id) => { await initialization; return adapter.services.getOrder(id) },
  saveQuotation: async (input, publish) => { await initialization; return adapter.services.saveQuotation(input, publish) },
  login: async (input) => { await initialization; return adapter.services.login(input) },
  logout: async () => { await initialization; return adapter.services.logout() },
  requestPasswordReset: async (input) => { await initialization; return adapter.services.requestPasswordReset(input) },
  resetPassword: async (input) => { await initialization; return adapter.services.resetPassword(input) },
  registerCustomer: async (input) => { await initialization; return adapter.services.registerCustomer(input) },
  submitStaffApplication: async (input) => { await initialization; return adapter.services.submitStaffApplication(input) },
  prepareDocuments: async (files) => { await initialization; return adapter.services.prepareDocuments(files) },
  getDashboard: async () => { await initialization; return adapter.services.getDashboard() },
  getResetContext: () => adapter.services.getResetContext(),
}
