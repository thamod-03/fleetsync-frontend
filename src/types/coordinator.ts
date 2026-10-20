import type { Customer, CustomerCompany, FareQuotation, Notification, Payment, TransportOrder, Trip, User, Vehicle, Driver, Mechanic } from './domain.ts'

export interface OrderDetails {
  order: TransportOrder
  customer: Customer
  company: CustomerCompany
  contact: User
  quotations: FareQuotation[]
  payments: Payment[]
  trips: Trip[]
  customerOrderCount: number
  vehicleTypes: string[]
}
export interface CoordinatorOverview {
  capturedAt: string
  orders: OrderDetails[]
  trips: { trip: Trip; order: TransportOrder; driver: User }[]
  vehicles: Vehicle[]
  drivers: Driver[]
  mechanics: Mechanic[]
  notifications: Notification[]
}
