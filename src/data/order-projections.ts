import type { DemoDataset } from '../types/domain.ts'
import type { OrderDetails } from '../types/coordinator.ts'

export function projectOrders(data: DemoDataset): OrderDetails[] {
  return data.orders.filter((order) => order.status !== 'Draft').flatMap((order) => {
    const customer = data.customers.find((item) => item.id === order.customerId)
    const company = data.customerCompanies.find((item) => item.id === customer?.companyId)
    const contact = data.users.find((item) => item.id === customer?.userId)
    if (!customer || !company || !contact) return []
    const quotations = data.quotations.filter((quote) => quote.orderId === order.id)
    return [{ order, customer, company, contact, quotations,
      trips: data.trips.filter((trip) => trip.orderId === order.id),
      customerOrderCount: data.orders.filter((item) => item.customerId === customer.id && item.status !== 'Draft').length,
      vehicleTypes: [...new Set(['Heavy truck · up to 9 t', ...data.vehicles.map((vehicle) => vehicle.description)])],
      payments: data.payments.filter((payment) => quotations.some((quote) => quote.id === payment.quotationId)),
    }]
  }).sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt))
}
