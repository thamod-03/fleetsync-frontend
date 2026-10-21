import type { ServiceAdapter } from './contracts.ts'

const unavailable = async () => ({ ok: false as const, error: 'This service is currently unavailable. Please try again later.' })

// Production fails closed until a real server-backed adapter is implemented.
// No local session, fixture credential, or mock fallback is consulted here.
export const unavailableAdapter: ServiceAdapter = {
  services: {
    getCustomerWorkspace: unavailable, getCustomerOrder: unavailable, createCustomerOrder: unavailable,
    getReportContext: unavailable, generateReport: unavailable, recordReportExport: unavailable,
    getChatWorkspace: unavailable, getConversation: unavailable, sendChatMessage: unavailable, markConversationRead: unavailable,
    getMailbox: unavailable, saveMail: unavailable, setMailFlag: unavailable,
    getTrips: unavailable, getTripDetails: unavailable, cancelTrip: unavailable, completeTrip: unavailable,
    getAvailability: unavailable, getTripAssignmentContext: unavailable, getAssignedTrip: unavailable,
    createTrip: unavailable, requeueTripNotification: unavailable,
    getCoordinatorOverview: unavailable, getSubmittedOrders: unavailable, getOrder: unavailable,
    saveQuotation: unavailable,
    login: unavailable, logout: async () => {}, requestPasswordReset: unavailable,
    resetPassword: unavailable, registerCustomer: unavailable, submitStaffApplication: unavailable,
    prepareDocuments: unavailable, getDashboard: unavailable, getResetContext: () => ({}),
  },
  getCurrentUser: () => null, getStorageNotice: () => null, subscribe: () => () => {},
}
