import type { OrderDetails } from '../../types/coordinator'
import type { NewOrderValues } from '../../types/customer'

export const customerOrderTabs = ['All', 'Pending review', 'Quoted', 'In progress', 'Completed', 'Declined'] as const
export type CustomerOrderTab = typeof customerOrderTabs[number]
export function customerOrderStatus(item: OrderDetails): string {
  const latest = item.trips.at(-1)
  if (latest?.status === 'In Progress') return 'Trip in progress'
  if (latest?.status === 'Completed') return 'Completed'
  if (latest?.status === 'Cancelled') return 'Cancelled'
  if (latest?.status === 'Assigned' || latest?.status === 'Draft') return latest.status
  if (item.order.status === 'Submitted') return 'Pending review'
  if (item.order.status === 'Declined') return 'Quote declined'
  return item.order.status
}
export function matchesCustomerTab(item: OrderDetails, tab: CustomerOrderTab) {
  const status = customerOrderStatus(item)
  return tab === 'All' || (tab === 'In progress' ? status === 'Trip in progress' : tab === 'Declined' ? status === 'Quote declined' : status === tab)
}
export const customerDate = (value?: string) => value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Not recorded'
export const customerMoney = (value: number) => `LKR ${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
export const orderAmount = (item: OrderDetails) => item.quotations.at(-1)?.amount
export const wizardDefaults: NewOrderValues = { pickupAddress: '', origin: '', pickupDate: '', pickupTime: '', pickupContactName: '', pickupContactPhone: '', destinationAddress: '', destination: '', deliveryBy: '', receiverName: '', receiverPhone: '', cargo: '', packing: '', weightKg: Number.NaN, palletCount: undefined, palletSize: '', cargoDescription: '', handling: [], customerNote: '', confirmed: false }
