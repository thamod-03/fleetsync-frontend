import { z } from 'zod'

export const userRoles = ['admin', 'customer', 'coordinator', 'driver', 'mechanic'] as const
export const webRoles = ['admin', 'customer', 'coordinator'] as const
export type UserRole = (typeof userRoles)[number]
export type WebRole = (typeof webRoles)[number]
export const tripStatuses = ['Draft', 'Assigned', 'In Progress', 'Completed', 'Cancelled'] as const
export type TripStatus = (typeof tripStatuses)[number]

const id = z.string().min(1)
const timestamp = z.iso.datetime()
const record = { id }
export const staffRoles = ['driver', 'mechanic', 'coordinator'] as const
export const demoDocumentSchema = z.object({
  kind: z.enum(['nic', 'driving-licence']), name: z.string().min(1),
  sizeBytes: z.number().positive().max(5 * 1024 * 1024),
  format: z.enum(['pdf', 'jpg']), simulated: z.literal(true),
})
export const userSchema = z.object({ ...record, name: z.string().min(1), email: z.email(), role: z.enum(userRoles), accountStatus: z.enum(['Pending', 'Active']).optional() })
export const customerCompanySchema = z.object({ ...record, name: z.string().min(1), businessRegistrationNumber: z.string().optional(), billingAddress: z.string().optional() })
export const customerSchema = z.object({ ...record, userId: id, companyId: id, mobile: z.string().optional() })
export const customerRegistrationSchema = z.object({ ...record, customerId: id, status: z.literal('Pending'), createdAt: timestamp })
export const staffSubmissionSchema = z.object({
  ...record, fullName: z.string(), nicNumber: z.string().min(1), email: z.email(), mobile: z.string(),
  role: z.enum(staffRoles), documents: z.array(demoDocumentSchema), status: z.literal('Pending'), createdAt: timestamp,
})
export const loginAttemptSchema = z.object({ ...record, failures: z.number().int().nonnegative().max(5), lockedUntil: z.number().nonnegative() })
const resource = { ...record, available: z.boolean() }
export const vehicleSchema = z.object({ ...resource, registration: z.string().min(1), description: z.string().min(1) })
export const driverSchema = z.object({ ...resource, userId: id })
export const mechanicSchema = z.object({ ...resource, userId: id })
export const transportOrderSchema = z.object({
  ...record, customerId: id, origin: z.string().min(1), destination: z.string().min(1),
  cargo: z.string().min(1), createdAt: timestamp,
  status: z.enum(['Draft', 'Submitted', 'Quoted', 'Accepted', 'Declined']),
})
export const fareQuotationSchema = z.object({
  ...record, orderId: id, amount: z.number().nonnegative(), currency: z.literal('LKR'),
  status: z.enum(['Pending', 'Accepted', 'Declined']),
})
export const assignmentSchema = z.object({ vehicleId: id, driverId: id, mechanicId: id })
const tripBase = z.object({ ...record, orderId: id, assignment: assignmentSchema })
export const tripSchema = z.discriminatedUnion('status', [
  tripBase.extend({ status: z.enum(['Draft', 'Assigned', 'In Progress', 'Cancelled']) }),
  tripBase.extend({ status: z.literal('Completed'), actualReturnDate: timestamp, finalOdometer: z.number().nonnegative() }),
])
export const paymentSchema = z.object({
  ...record, quotationId: id, amount: z.number().nonnegative(), currency: z.literal('LKR'),
  status: z.enum(['Pending', 'Succeeded', 'Failed']), simulated: z.literal(true),
})
export const notificationSchema = z.object({ ...record, userId: id, message: z.string(), read: z.boolean(), createdAt: timestamp, simulated: z.literal(true) })
export const chatMessageSchema = z.object({ ...record, senderId: id, recipientId: id, text: z.string(), createdAt: timestamp, simulated: z.literal(true) })
export const auditEventSchema = z.object({ ...record, actorId: id, action: z.string(), entityId: id, createdAt: timestamp })

const datasetShape = z.object({
  users: z.array(userSchema), customerCompanies: z.array(customerCompanySchema), customers: z.array(customerSchema),
  vehicles: z.array(vehicleSchema), drivers: z.array(driverSchema), mechanics: z.array(mechanicSchema),
  orders: z.array(transportOrderSchema), quotations: z.array(fareQuotationSchema), trips: z.array(tripSchema),
  payments: z.array(paymentSchema), notifications: z.array(notificationSchema),
  chatMessages: z.array(chatMessageSchema), auditEvents: z.array(auditEventSchema),
  customerRegistrations: z.array(customerRegistrationSchema).default([]),
  staffApplications: z.array(staffSubmissionSchema).default([]),
  loginAttempts: z.array(loginAttemptSchema).default([]),
})

export const demoDatasetSchema = datasetShape.superRefine((data, context) => {
  const invalid = (message: string) => context.addIssue({ code: 'custom', message })
  for (const records of Object.values(data)) {
    if (new Set(records.map((item) => item.id)).size !== records.length) invalid('Duplicate record IDs')
  }
  const userHasRole = (userId: string, role: UserRole) => data.users.some((user) => user.id === userId && user.role === role)
  if (new Set(data.users.map((user) => user.email.toLowerCase())).size !== data.users.length) invalid('Duplicate user emails')
  if (data.customerRegistrations.some((registration) => !data.customers.some((customer) => customer.id === registration.customerId && data.users.some((user) => user.id === customer.userId && user.accountStatus === 'Pending')))) invalid('Invalid pending registration')
  for (const customer of data.customers) {
    if (!userHasRole(customer.userId, 'customer') || !data.customerCompanies.some((company) => company.id === customer.companyId)) invalid('Invalid customer relationship')
  }
  for (const [resources, role] of [[data.drivers, 'driver'], [data.mechanics, 'mechanic']] as const) {
    if (resources.some((item) => !userHasRole(item.userId, role))) invalid('Invalid staff relationship')
  }
  for (const role of ['customer', 'driver', 'mechanic'] as const) {
    const profiles = role === 'customer' ? data.customers : role === 'driver' ? data.drivers : data.mechanics
    if (new Set(profiles.map((profile) => profile.userId)).size !== profiles.length) invalid('Duplicate user profile')
    if (data.users.some((user) => user.role === role && !profiles.some((profile) => profile.userId === user.id))) invalid('Missing user profile')
  }
  if (data.orders.some((order) => !data.customers.some((customer) => customer.id === order.customerId))) invalid('Unknown order customer')
  if (data.quotations.some((quote) => !data.orders.some((order) => order.id === quote.orderId))) invalid('Unknown quotation order')
  if (data.payments.some((payment) => !data.quotations.some((quote) => quote.id === payment.quotationId))) invalid('Unknown payment quotation')
  const occupied = { vehicleId: new Set<string>(), driverId: new Set<string>(), mechanicId: new Set<string>() }
  for (const trip of data.trips) {
    if (!data.orders.some((order) => order.id === trip.orderId)) invalid('Unknown trip order')
    for (const [key, resources] of [['vehicleId', data.vehicles], ['driverId', data.drivers], ['mechanicId', data.mechanics]] as const) {
      const resource = resources.find((item) => item.id === trip.assignment[key])
      if (!resource) invalid('Unknown assigned resource')
      if (['Draft', 'Assigned', 'In Progress'].includes(trip.status)) {
        if (occupied[key].has(trip.assignment[key]) || resource?.available) invalid('Conflicting resource assignment')
        occupied[key].add(trip.assignment[key])
      }
    }
  }
  const knownUser = (userId: string) => data.users.some((user) => user.id === userId)
  if (data.notifications.some((item) => !knownUser(item.userId)) ||
    data.chatMessages.some((item) => !knownUser(item.senderId) || !knownUser(item.recipientId)) ||
    data.auditEvents.some((item) => !knownUser(item.actorId))) invalid('Unknown message or audit user')
})

export type User = z.infer<typeof userSchema>
export type Customer = z.infer<typeof customerSchema>
export type CustomerCompany = z.infer<typeof customerCompanySchema>
export type Vehicle = z.infer<typeof vehicleSchema>
export type Driver = z.infer<typeof driverSchema>
export type Mechanic = z.infer<typeof mechanicSchema>
export type TransportOrder = z.infer<typeof transportOrderSchema>
export type FareQuotation = z.infer<typeof fareQuotationSchema>
export type ResourceAssignment = z.infer<typeof assignmentSchema>
export type Trip = z.infer<typeof tripSchema>
export type Payment = z.infer<typeof paymentSchema>
export type Notification = z.infer<typeof notificationSchema>
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type AuditEvent = z.infer<typeof auditEventSchema>
export type DemoDataset = z.infer<typeof demoDatasetSchema>
export type CustomerRegistration = z.infer<typeof customerRegistrationSchema>
export type StaffApplication = z.infer<typeof staffSubmissionSchema>
export type DemoDocument = z.infer<typeof demoDocumentSchema>
