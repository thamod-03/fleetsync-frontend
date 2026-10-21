import type { DemoStore } from '../store/demo-store.ts'
import type { TransportOrder } from '../types/domain.ts'
import type { CreateCustomerOrderInput, CustomerOrderDetails, CustomerTripInfo, CustomerWorkspace } from '../types/customer.ts'
import { createCustomerOrderSchema } from '../types/customer.ts'
import type { ServiceResult } from '../services/contracts.ts'
import { projectOrders } from './order-projections.ts'

const fail = (error: string) => ({ ok: false as const, error })
export function createCustomerServices(store: DemoStore, delayMs: number) {
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  const identity = () => {
    const { data, sessionUserId } = store.getState()
    const user = data.users.find((item) => item.id === sessionUserId && item.role === 'customer' && item.accountStatus !== 'Pending')
    const customer = data.customers.find((item) => item.userId === user?.id)
    const company = data.customerCompanies.find((item) => item.id === customer?.companyId)
    return user && customer && company ? { user, customer, company } : null
  }
  const ordersFor = (customerId: string) => projectOrders(store.getState().data).filter((item) => item.customer.id === customerId).map((item) => {
    const quotations = item.quotations.filter((quote) => quote.status !== 'Draft')
    return { ...item, quotations, payments: item.payments.filter((payment) => quotations.some((quote) => quote.id === payment.quotationId)) }
  })
  const tripInfo = (orderIds: string[]): CustomerTripInfo[] => {
    const { data } = store.getState()
    return data.trips.filter((trip) => orderIds.includes(trip.orderId)).map((trip) => ({ trip, vehicle: data.vehicles.find((item) => item.id === trip.assignment.vehicleId) ?? null, driver: data.users.find((user) => user.id === data.drivers.find((item) => item.id === trip.assignment.driverId)?.userId) ?? null, mechanic: data.users.find((user) => user.id === data.mechanics.find((item) => item.id === trip.assignment.mechanicId)?.userId) ?? null }))
  }
  return {
    async getCustomerWorkspace(): Promise<ServiceResult<CustomerWorkspace>> {
      await wait(); const person = identity()
      if (!person) return fail('Your customer account is unavailable.')
      const orders = ordersFor(person.customer.id)
      return { ok: true, data: structuredClone({ ...person, orders, trips: tripInfo(orders.map((item) => item.order.id)), notifications: store.getState().data.notifications.filter((item) => item.userId === person.user.id), capturedAt: new Date().toISOString() }) }
    },
    async getCustomerOrder(id: string): Promise<ServiceResult<CustomerOrderDetails>> {
      await wait(); const person = identity()
      if (!person) return fail('This order could not be found.')
      const details = ordersFor(person.customer.id).find((item) => item.order.id === id)
      if (!details) return fail('This order could not be found.')
      const ids = [id, ...details.trips.map((trip) => trip.id), ...details.quotations.map((quote) => quote.id), ...details.payments.map((payment) => payment.id)]
      return { ok: true, data: structuredClone({ details, trips: tripInfo([id]), activity: store.getState().data.auditEvents.filter((item) => ids.includes(item.entityId)).map(({ id, action, createdAt }) => ({ id, action: action.replace(/^Demo\s+/i, ''), createdAt })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }) }
    },
    async createCustomerOrder(input: CreateCustomerOrderInput): Promise<ServiceResult<TransportOrder>> {
      await wait(); const person = identity(); const parsed = createCustomerOrderSchema.safeParse(input)
      if (!person) return fail('Only an active customer can submit a transport order.')
      if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the order fields.')
      const { requestId, confirmed: _confirmed, ...values } = parsed.data
      void _confirmed
      const { data } = store.getState()
      const submissionKey = `${person.customer.id}:${requestId}`
      const fingerprint = JSON.stringify(values)
      const existing = data.orders.find((order) => order.submissionKey === submissionKey)
      if (existing) return existing.submissionFingerprint === fingerprint ? { ok: true, data: structuredClone(existing) } : fail('This submission has already been used for a different order. Start a new order.')
      const pickupAt = new Date(`${values.pickupDate}T${values.pickupTime}`).toISOString()
      const deliveryBy = new Date(values.deliveryBy).toISOString()
      const order: TransportOrder = {
        id: `order-${crypto.randomUUID()}`, customerId: person.customer.id, origin: values.origin, destination: values.destination, cargo: values.cargo, status: 'Submitted', createdAt: new Date().toISOString(),
        pickupAt, deliveryBy, deliveryInstructions: `Deliver by ${deliveryBy}`, weightTonnes: values.weightKg / 1000,
        pickupAddress: values.pickupAddress, pickupContactName: values.pickupContactName, pickupContactPhone: values.pickupContactPhone,
        destinationAddress: values.destinationAddress, receiverName: values.receiverName, receiverPhone: values.receiverPhone,
        packing: values.packing, cargoDescription: values.cargoDescription, palletCount: values.palletCount, palletSize: values.palletSize,
        pallets: values.palletCount === undefined ? undefined : `${values.palletCount} pallets${values.palletSize ? ` (${values.palletSize})` : ''}`,
        handling: values.handling.join(', '), customerNote: values.customerNote, submissionKey, submissionFingerprint: fingerprint,
      }
      store.setState({ data: { ...data, orders: [...data.orders, order], auditEvents: [...data.auditEvents, { id: `audit-${crypto.randomUUID()}`, actorId: person.user.id, action: 'Transport order submitted', entityId: order.id, createdAt: order.createdAt }] } })
      return { ok: true, data: structuredClone(order) }
    },
  }
}
