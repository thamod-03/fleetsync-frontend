import { z } from 'zod'
import type { Customer, CustomerCompany, Notification, Trip, User, Vehicle } from './domain.ts'
import type { OrderDetails } from './coordinator.ts'

const required = (label: string) => z.string().trim().min(1, `${label} is required.`).max(500)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.').refine((value) => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, 'Choose a valid date.')
const phone = required('Phone').max(40).regex(/^\+?[\d\s().-]+$/, 'Enter a valid phone number.').refine((value) => /\d/.test(value), 'Enter a phone number.')
export const handlingOptions = ['Fragile', 'Keep upright', 'Needs a covered truck', 'Forklift at pickup', 'Forklift at destination', 'Loading help needed'] as const
export const orderRouteSchema = z.object({
  pickupAddress: required('Pickup address'), origin: required('Pickup city'), pickupDate: date,
  pickupTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a valid pickup time.'),
  pickupContactName: required('Contact person'), pickupContactPhone: phone,
  destinationAddress: required('Destination address'), destination: required('Destination city'),
  deliveryBy: z.string().regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, 'Choose a delivery date and time.').refine((value) => date.safeParse(value.slice(0, 10)).success && Number.isFinite(Date.parse(value)), 'Choose a valid delivery date and time.'),
  receiverName: required('Receiver name'), receiverPhone: phone,
}).refine((input) => Date.parse(input.deliveryBy) >= Date.parse(`${input.pickupDate}T${input.pickupTime}`), { path: ['deliveryBy'], message: 'Delivery must be at or after pickup.' })
export const orderCargoSchema = z.object({
  cargo: required('Cargo type'), packing: required('Packing'), weightKg: z.number({ error: 'Enter the total weight.' }).positive('Weight must be greater than zero.'),
  palletCount: z.number().int('Use a whole number of pallets.').nonnegative('Pallet count cannot be negative.').optional(),
  palletSize: z.string().trim().max(200), cargoDescription: z.string().trim().min(1, 'Describe the cargo.').max(4000),
  handling: z.array(z.enum(handlingOptions)), customerNote: z.string().trim().max(4000),
})
export const orderReviewSchema = z.object({ confirmed: z.boolean().refine((value) => value, 'Confirm that the order details are correct.') })
export const newOrderSchema = orderRouteSchema.safeExtend({ ...orderCargoSchema.shape, ...orderReviewSchema.shape })
export const createCustomerOrderSchema = newOrderSchema.safeExtend({ requestId: z.string().uuid() })
export type NewOrderValues = z.infer<typeof newOrderSchema>
export type CreateCustomerOrderInput = z.infer<typeof createCustomerOrderSchema>
export interface CustomerTripInfo { trip: Trip; vehicle: Vehicle | null; driver: User | null; mechanic: User | null }
export interface CustomerWorkspace {
  user: User; customer: Customer; company: CustomerCompany; orders: OrderDetails[]; trips: CustomerTripInfo[]; notifications: Notification[]; capturedAt: string
}
export interface CustomerOrderDetails { details: OrderDetails; trips: CustomerTripInfo[]; activity: { id: string; action: string; createdAt: string }[] }
