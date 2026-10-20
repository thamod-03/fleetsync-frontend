import { unavailableAdapter } from './unavailable-adapter.ts'
import type { ApplicationServices } from './contracts.ts'

let adapter = unavailableAdapter
let revision = 0
const listeners = new Set<() => void>()
const notify = () => { revision++; listeners.forEach((listener) => listener()) }

// Vite replaces DEV at build time. There is no runtime flag or URL switch.
const initialization = import.meta.env.DEV && __FLEETSYNC_LOCAL_DEV__
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
