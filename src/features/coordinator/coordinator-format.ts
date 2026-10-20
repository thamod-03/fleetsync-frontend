import type { OrderDetails } from '../../types/coordinator'

export const money = (amount: number) => `LKR ${new Intl.NumberFormat('en-LK', { maximumFractionDigits: 2 }).format(amount)}`
export function orderStatus(item: OrderDetails) {
  if (item.payments.some((payment) => payment.status === 'Succeeded')) return 'Paid'
  if (item.payments.some((payment) => payment.status === 'Failed')) return 'Payment failed'
  if (item.order.status === 'Submitted') return 'Pending review'
  if (item.order.status === 'Accepted') return 'Awaiting payment'
  return item.order.status
}


export const orderTabs = ['All open', 'Needs quotation', 'Quoted', 'Ready for a trip', 'Closed'] as const
export type OrderTab = typeof orderTabs[number]
export function paymentStatus(item: OrderDetails) {
  if (item.payments.some((payment) => payment.status === 'Succeeded')) return 'Paid'
  if (item.payments.some((payment) => payment.status === 'Failed')) return 'Payment failed'
  return item.order.status === 'Accepted' ? 'Awaiting payment' : 'Not due yet'
}
export function workflowStatus(item: OrderDetails) {
  if (item.trips.some((trip) => trip.status !== 'Cancelled')) return 'Trip created'
  return item.order.status === 'Submitted' ? 'Pending review' : item.order.status
}
export function matchesTab(item: OrderDetails, tab: OrderTab) {
  const closed = item.order.status === 'Declined' || item.trips.some((trip) => trip.status === 'Completed')
  if (tab === 'Closed') return closed
  if (closed) return false
  if (tab === 'Needs quotation') return item.order.status === 'Submitted'
  if (tab === 'Quoted') return item.order.status === 'Quoted'
  if (tab === 'Ready for a trip') return paymentStatus(item) === 'Paid' && !item.trips.some((trip) => trip.status !== 'Cancelled')
  return true
}
export function filterOrders(orders: OrderDetails[], filters: { tab: OrderTab; search: string; pickup: string; payment: string }) {
  const needle = filters.search.trim().toLowerCase()
  return orders.filter((item) => matchesTab(item, filters.tab)
    && (!needle || [item.order.id, item.company.name, item.contact.name, item.order.origin, item.order.destination, item.order.cargo].some((value) => value.toLowerCase().includes(needle)))
    && (!filters.pickup || (item.order.pickupAt && new Date(item.order.pickupAt).toLocaleDateString('en-CA') === filters.pickup))
    && (!filters.payment || paymentStatus(item) === filters.payment))
}
export function formatDate(value: string | undefined, withTime = true) {
  if (!value) return 'Not provided'
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } as const : {}) })
}
export function ordersCsv(orders: OrderDetails[]) {
  const cell = (value: string) => `"${(/^[\s]*[=+@-]|^[\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`
  const rows = [['Order', 'Customer', 'Origin', 'Destination', 'Pickup', 'Cargo', 'Payment', 'Status'], ...orders.map((item) => [item.order.id, item.company.name, item.order.origin, item.order.destination, item.order.pickupAt ?? '', item.order.cargo, paymentStatus(item), workflowStatus(item)])]
  return rows.map((row) => row.map(cell).join(',')).join('\r\n')
}
