import { projectOrders } from './order-projections.ts'
import type { DemoStore } from '../store/demo-store.ts'
import type { OrderDetails, CoordinatorOverview } from '../types/coordinator.ts'
import type { ServiceResult } from '../services/contracts.ts'
import { quotationInputSchema, totalFare, type QuotationInput } from '../types/quotation.ts'
import type { FareQuotation } from '../types/domain.ts'
import type { QuotationNotificationService } from '../services/quotation-notifications.ts'
import { localQuotationNotifications } from './quotation-notifications.ts'

export function createCoordinatorServices(store: DemoStore, delayMs: number, notifier: QuotationNotificationService = localQuotationNotifications) {
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  const denied = () => ({ ok: false as const, error: 'You do not have permission to view operational records.' })
  const actor = () => store.getState().data.users.find((user) => user.id === store.getState().sessionUserId && user.accountStatus !== 'Pending')
  const details = () => projectOrders(store.getState().data)
  return {
    async getSubmittedOrders(): Promise<ServiceResult<OrderDetails[]>> {
      await wait()
      if (actor()?.role !== 'coordinator') return denied()
      return { ok: true, data: structuredClone(details()) }
    },
    async getOrder(orderId: string): Promise<ServiceResult<OrderDetails>> {
      await wait()
      const user = actor()
      if (!user || !['coordinator', 'customer'].includes(user.role)) return denied()
      const result = details().find((item) => item.order.id === orderId && (user.role === 'coordinator' || item.contact.id === user.id))
      return result ? { ok: true, data: structuredClone({ ...result, quotations: result.quotations.filter((quote) => user.role === 'coordinator' || quote.status !== 'Draft') }) } : { ok: false, error: 'This order could not be found.' }
    },
    async saveQuotation(input: QuotationInput, publish: boolean): Promise<ServiceResult<{ quotation: FareQuotation; emailDelivered: boolean }>> {
      await wait()
      const user = actor()
      if (user?.role !== 'coordinator') return denied()
      const parsed = quotationInputSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: 'Check the vehicle type, charges and validity date.' }
      const values = parsed.data
      const { data } = store.getState()
      const order = data.orders.find((item) => item.id === values.orderId)
      if (!order || order.status === 'Draft') return { ok: false, error: 'This submitted order could not be found.' }
      if (['Accepted', 'Declined'].includes(order.status)) return { ok: false, error: 'This order already has a customer decision. Its quotation cannot be changed here.' }
      const previous = data.quotations.find((quote) => quote.orderId === order.id && quote.status === 'Draft')
      if (data.quotations.some((quote) => quote.orderId === order.id && quote.status !== 'Draft')) return { ok: false, error: 'A quotation has already been issued for this order.' }
      if ((values.draftId && previous?.id !== values.draftId) || (!values.draftId && previous)) return { ok: false, error: 'The saved draft has changed. Reload the order before continuing.' }
      if (publish && Date.parse(values.validUntil) <= Date.now()) return { ok: false, error: 'Choose a quotation validity time in the future.' }
      const customer = data.customers.find((item) => item.id === order.customerId)
      const recipient = data.users.find((item) => item.id === customer?.userId)
      if (!recipient) return { ok: false, error: 'The customer account could not be found.' }
      const createdAt = previous?.createdAt ?? new Date().toISOString()
      const quotation: FareQuotation = {
        id: previous?.id ?? `quotation-${crypto.randomUUID()}`, orderId: order.id,
        amount: totalFare(values.charges), currency: 'LKR', status: publish ? 'Pending' : 'Draft',
        vehicleType: values.vehicleType, charges: values.charges, validUntil: values.validUntil, message: values.message, createdAt,
      }
      let delivery = { message: '', emailDelivered: false }
      try { if (publish) delivery = notifier.prepare(quotation, recipient) }
      catch { return { ok: false, error: 'Unable to prepare the quotation notification. Nothing was saved. Please try again.' } }
      // Rechecks and all local record changes happen in the same synchronous commit.
      store.setState({ data: { ...data,
        quotations: [...data.quotations.filter((quote) => quote.id !== quotation.id), quotation],
        orders: data.orders.map((item) => item.id === order.id && publish ? { ...item, status: 'Quoted' } : item),
        notifications: publish ? [...data.notifications, { id: `notification-${crypto.randomUUID()}`, userId: recipient.id, message: delivery.message, read: false, createdAt: new Date().toISOString(), simulated: true }] : data.notifications,
        auditEvents: [...data.auditEvents, { id: `audit-${crypto.randomUUID()}`, actorId: user.id, action: publish ? 'Quotation published' : 'Quotation draft saved', entityId: quotation.id, createdAt: new Date().toISOString() }],
      } })
      return { ok: true, data: { quotation: structuredClone(quotation), emailDelivered: delivery.emailDelivered } }
    },
    async getCoordinatorOverview(): Promise<ServiceResult<CoordinatorOverview>> {
      await wait()
      const user = actor()
      if (user?.role !== 'coordinator') return denied()
      const data = store.getState().data
      return { ok: true, data: structuredClone({
        capturedAt: new Date().toISOString(),
        orders: details(), vehicles: data.vehicles, drivers: data.drivers, mechanics: data.mechanics,
        notifications: data.notifications.filter((item) => item.userId === user.id),
        trips: data.trips.filter((trip) => ['Assigned', 'In Progress'].includes(trip.status)).flatMap((trip) => {
          const order = data.orders.find((item) => item.id === trip.orderId)
          const profile = data.drivers.find((item) => item.id === trip.assignment.driverId)
          const driver = data.users.find((item) => item.id === profile?.userId)
          return order && driver ? [{ trip, order, driver }] : []
        }),
      }) }
    },
  }
}
