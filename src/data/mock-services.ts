import { resetLocalPaymentProvider } from './local-payment-provider.ts'
import { createCustomerBillingServices } from './customer-billing-services.ts'
import { createTripServices } from './trip-services.ts'
import { createTripManagementServices } from './trip-management-services.ts'
import { createCommunicationServices } from './communication-services.ts'
import { createReportServices } from './report-services.ts'
import { createCustomerServices } from './customer-services.ts'
export type { CreateTripInput } from '../types/trip-assignment.ts'
import { createSeedData } from './seed.ts'
import { demoStore, type DemoStore } from '../store/demo-store.ts'
import { type WebRole } from '../types/domain.ts'
import { createAuthServices } from './auth-services.ts'
import { createCoordinatorServices } from './coordinator-services.ts'
export type { ServiceResult } from '../services/contracts.ts'

export function createMockServices(store: DemoStore, delayMs = 180) {
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  const currentUser = () => {
    const state = store.getState()
    return state.data.users.find((user) => user.id === state.sessionUserId)
  }
  const failure = (error: string): { ok: false; error: string } => ({ ok: false, error })
  return {
    ...createAuthServices(store, delayMs),
    ...createCoordinatorServices(store, delayMs),
    ...createTripServices(store, delayMs),
    ...createTripManagementServices(store, delayMs),
    ...createCommunicationServices(store, delayMs),
    ...createReportServices(store, delayMs),
    ...createCustomerServices(store, delayMs),
    ...createCustomerBillingServices(store, delayMs),
    async getNotifications() {
      const actorId = currentUser()?.id
      await wait()
      const actor = currentUser()
      if (!actor || actor.id !== actorId || actor.accountStatus === 'Pending') return failure('Sign in to view notifications.')
      return { ok: true as const, data: structuredClone(store.getState().data.notifications.filter((item) => item.userId === actor.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))) }
    },
    async markAllNotificationsRead() {
      const actorId = currentUser()?.id
      await wait()
      const actor = currentUser()
      if (!actor || actor.id !== actorId || actor.accountStatus === 'Pending') return failure('Sign in to update notifications.')
      const { data } = store.getState()
      if (data.notifications.some((item) => item.userId === actor.id && !item.read)) {
        store.setState({ data: { ...data, notifications: data.notifications.map((item) => item.userId === actor.id && !item.read ? { ...item, read: true } : item) } })
      }
      return { ok: true as const, data: null }
    },
    async signIn(role: WebRole) {
      await wait()
      const user = store.getState().data.users.find((item) => item.role === role && item.accountStatus !== 'Pending')
      if (!user) return failure('This demo persona is unavailable. Reset demo data to restore it.')
      store.setState({ sessionUserId: user.id, rememberSession: true })
      return { ok: true as const, data: user }
    },
    async logout() {
      await wait()
      store.setState({ sessionUserId: null })
    },
    async resetDemoData() {
      await wait()
      resetLocalPaymentProvider()
      const data = createSeedData()
      const sessionUserId = data.users.some((user) => user.id === store.getState().sessionUserId) ? store.getState().sessionUserId : null
      store.setState({ data, sessionUserId })
    },
    async getDashboard() {
      await wait()
      const user = currentUser()
      if (!user) return failure('Choose a demo persona to continue.')
      const { data } = store.getState()
      const customerId = data.customers.find((customer) => customer.userId === user.id)?.id
      const orders = user.role === 'customer' ? data.orders.filter((order) => order.customerId === customerId) : data.orders
      const orderIds = new Set(orders.map((order) => order.id))
      return { ok: true as const, data: {
        orders: orders.length,
        quotations: data.quotations.filter((quote) => orderIds.has(quote.orderId) && (user.role !== 'customer' || quote.status !== 'Draft')).length,
        trips: data.trips.filter((trip) => orderIds.has(trip.orderId)).length,
        notifications: data.notifications.filter((item) => item.userId === user.id && !item.read).length,
      } }
    },
  }
}

export const mockServices = createMockServices(demoStore)
