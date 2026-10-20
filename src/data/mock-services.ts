import { z } from 'zod'
import { createSeedData } from './seed.ts'
import { demoStore, type DemoStore } from '../store/demo-store.ts'
import { assignmentSchema, type Trip, type WebRole } from '../types/domain.ts'

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string }
const tripInputSchema = z.object({ orderId: z.string().min(1), assignment: assignmentSchema })
export type CreateTripInput = z.infer<typeof tripInputSchema>

export function createMockServices(store: DemoStore, delayMs = 180) {
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  const currentUser = () => {
    const state = store.getState()
    return state.data.users.find((user) => user.id === state.sessionUserId)
  }
  const failure = (error: string): { ok: false; error: string } => ({ ok: false, error })
  return {
    async signIn(role: WebRole) {
      await wait()
      const user = store.getState().data.users.find((item) => item.role === role)
      if (!user) return failure('This demo persona is unavailable. Reset demo data to restore it.')
      store.setState({ sessionUserId: user.id })
      return { ok: true as const, data: user }
    },
    async logout() {
      await wait()
      store.setState({ sessionUserId: null })
    },
    async resetDemoData() {
      await wait()
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
        quotations: data.quotations.filter((quote) => orderIds.has(quote.orderId)).length,
        trips: data.trips.filter((trip) => orderIds.has(trip.orderId)).length,
        notifications: data.notifications.filter((item) => item.userId === user.id && !item.read).length,
      } }
    },
    async getAvailability() {
      await wait()
      if (!['admin', 'coordinator'].includes(currentUser()?.role ?? '')) return failure('This persona cannot view resource availability.')
      const { vehicles, drivers, mechanics } = store.getState().data
      return { ok: true as const, data: structuredClone({ vehicles, drivers, mechanics }) }
    },
    async createTrip(input: CreateTripInput): Promise<ServiceResult<Trip>> {
      await wait()
      const actor = currentUser()
      if (actor?.role !== 'coordinator') return failure('Only the Coordinator demo persona can assign a trip.')
      const parsed = tripInputSchema.safeParse(input)
      if (!parsed.success) return failure('An order, vehicle, driver, and mechanic are required.')
      const { orderId, assignment } = parsed.data
      // Recheck after the delay, then commit synchronously in this browser store.
      const { data } = store.getState()
      if (!data.orders.some((order) => order.id === orderId)) return failure('The selected order does not exist.')
      const resources = [
        data.vehicles.find((item) => item.id === assignment.vehicleId),
        data.drivers.find((item) => item.id === assignment.driverId),
        data.mechanics.find((item) => item.id === assignment.mechanicId),
      ]
      const conflict = data.trips.some((trip) => ['Draft', 'Assigned', 'In Progress'].includes(trip.status) &&
        (trip.assignment.vehicleId === assignment.vehicleId || trip.assignment.driverId === assignment.driverId || trip.assignment.mechanicId === assignment.mechanicId))
      if (resources.some((resource) => !resource?.available) || conflict) return failure('One or more resources are unavailable. Refresh availability and choose again.')
      const trip: Trip = { id: `trip-${crypto.randomUUID()}`, orderId, assignment, status: 'Assigned' }
      store.setState({ data: {
        ...data, trips: [...data.trips, trip],
        vehicles: data.vehicles.map((item) => item.id === assignment.vehicleId ? { ...item, available: false } : item),
        drivers: data.drivers.map((item) => item.id === assignment.driverId ? { ...item, available: false } : item),
        mechanics: data.mechanics.map((item) => item.id === assignment.mechanicId ? { ...item, available: false } : item),
        auditEvents: [...data.auditEvents, { id: `audit-${crypto.randomUUID()}`, actorId: actor.id, action: 'Demo trip assigned', entityId: trip.id, createdAt: new Date().toISOString() }],
      } })
      return { ok: true, data: structuredClone(trip) }
    },
  }
}

export const mockServices = createMockServices(demoStore)
