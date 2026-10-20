import { mockServices } from '../data/mock-services'
import { demoStore } from '../store/demo-store'
import type { ServiceAdapter } from '../services/contracts'
import type { DemoDocument } from '../types/domain'

let resetEmail: string | undefined

export const developmentAdapter: ServiceAdapter = {
  services: {
    getCoordinatorOverview: mockServices.getCoordinatorOverview,
    getSubmittedOrders: mockServices.getSubmittedOrders, getOrder: mockServices.getOrder,
    saveQuotation: mockServices.saveQuotation,
    login: mockServices.login, logout: mockServices.logout,
    registerCustomer: mockServices.registerCustomer, submitStaffApplication: mockServices.submitStaffApplication,
    getDashboard: mockServices.getDashboard,
    async requestPasswordReset(input) {
      const result = await mockServices.requestPasswordReset(input)
      if (result.ok) resetEmail = input.email.trim().toLowerCase()
      return result.ok ? { ok: true, data: { message: result.data.message, delivered: false } } : result
    },
    async resetPassword(input) {
      const result = await mockServices.simulatePasswordReset(input)
      return result.ok ? { ok: true, data: { message: result.data.message, updated: false } } : result
    },
    getResetContext: () => ({ email: resetEmail }),
    async prepareDocuments(files) {
      if (!files.length) return { ok: false, error: 'Choose a PDF or JPG file.' }
      if (files.some((file) => file.size <= 0 || file.size > 5 * 1024 * 1024 || !/\.(pdf|jpe?g)$/i.test(file.name) || !['', 'application/pdf', 'image/jpeg'].includes(file.type))) {
        return { ok: false, error: 'Choose PDF or JPG files up to 5 MB each.' }
      }
      // Read metadata only. Never read bytes, persist a File/Blob, or upload contents.
      const documents: DemoDocument[] = files.map((file) => ({
        name: file.name, sizeBytes: file.size,
        kind: /driv|licen[cs]e/i.test(file.name) ? 'driving-licence' : 'nic',
        format: /\.pdf$/i.test(file.name) ? 'pdf' : 'jpg', simulated: true,
      }))
      return { ok: true, data: documents }
    },
  },
  getCurrentUser: () => {
    const state = demoStore.getState()
    return state.data.users.find((user) => user.id === state.sessionUserId && user.accountStatus !== 'Pending') ?? null
  },
  getStorageNotice: () => demoStore.getState().storageNotice,
  subscribe: (listener) => demoStore.subscribe(listener),
}
