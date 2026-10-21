import { z } from 'zod'
import { fareChargesSchema, totalFare } from './quotation.ts'
import { holdsTripResources } from './trip-policy.ts'
import { conversationSchema, mailMessageSchema, conversationOwnerId } from './communications.ts'
import { reportExportSchema } from './reporting.ts'
import { paymentInstrumentSchema } from './customer-billing.ts'

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
export const customerSchema = z.object({ ...record, userId: id, companyId: id, mobile: z.string().optional(), joinedAt: timestamp.optional() })
export const customerRegistrationSchema = z.object({ ...record, customerId: id, status: z.literal('Pending'), createdAt: timestamp })
export const staffSubmissionSchema = z.object({
  ...record, fullName: z.string(), nicNumber: z.string().min(1), email: z.email(), mobile: z.string(),
  role: z.enum(staffRoles), documents: z.array(demoDocumentSchema), status: z.literal('Pending'), createdAt: timestamp,
})
export const loginAttemptSchema = z.object({ ...record, failures: z.number().int().nonnegative().max(5), lockedUntil: z.number().nonnegative() })
const resource = { ...record, available: z.boolean() }
export const vehicleSchema = z.object({ ...resource, registration: z.string().min(1), description: z.string().min(1), capacityTonnes: z.number().positive().optional(), homeBase: z.string().optional(), nextServiceKm: z.number().nonnegative().optional(), inMaintenance: z.boolean().optional() })
export const driverSchema = z.object({ ...resource, userId: id, licence: z.string().optional() })
export const mechanicSchema = z.object({ ...resource, userId: id, speciality: z.string().optional(), workshop: z.string().optional() })
export const transportOrderSchema = z.object({
  ...record, customerId: id, origin: z.string().min(1), destination: z.string().min(1),
  cargo: z.string().min(1), createdAt: timestamp,
  pickupAt: timestamp.optional(), deliveryInstructions: z.string().optional(),
  estimatedReturnAt: timestamp.optional(),
  distanceKm: z.number().positive().optional(), weightTonnes: z.number().positive().optional(),
  pallets: z.string().optional(), handling: z.string().optional(), customerNote: z.string().optional(),
  pickupAddress: z.string().optional(), pickupContactName: z.string().optional(), pickupContactPhone: z.string().optional(),
  destinationAddress: z.string().optional(), receiverName: z.string().optional(), receiverPhone: z.string().optional(),
  deliveryBy: timestamp.optional(), packing: z.string().optional(), cargoDescription: z.string().optional(),
  palletCount: z.number().int().nonnegative().optional(), palletSize: z.string().optional(),
  submissionKey: z.string().optional(), submissionFingerprint: z.string().optional(),
  status: z.enum(['Draft', 'Submitted', 'Quoted', 'Accepted', 'Declined']),
})
export const fareQuotationSchema = z.object({
  ...record, orderId: id, amount: z.number().nonnegative(), currency: z.literal('LKR'),
  status: z.enum(['Draft', 'Pending', 'Accepted', 'Declined']),
  vehicleType: z.string().min(1).optional(), charges: fareChargesSchema.optional(),
  validUntil: timestamp.optional(), message: z.string().optional(), createdAt: timestamp.optional(),
  publishedAt: timestamp.optional(), decidedAt: timestamp.optional(), decidedBy: id.optional(), decisionRequestId: z.uuid().optional(),
})
export const assignmentSchema = z.object({ vehicleId: id, driverId: id, mechanicId: id })
const tripBase = z.object({ ...record, orderId: id, assignment: assignmentSchema,
  scheduledStart: timestamp.optional(), scheduledEnd: timestamp.optional(), createdAt: timestamp.optional(), createdBy: id.optional(),
  actualStartAt: timestamp.optional(), startingOdometer: z.number().nonnegative().optional(),
  cancellationReason: z.string().trim().min(1).optional(), cancellationDetails: z.string().optional(),
  cancelledAt: timestamp.optional(), cancelledBy: id.optional(), completedBy: id.optional(),
  resourcesHeld: z.boolean().optional(), notes: z.string().optional(),
})
export const tripSchema = z.discriminatedUnion('status', [
  tripBase.extend({ status: z.enum(['Draft', 'Assigned', 'In Progress', 'Cancelled']) }),
  tripBase.extend({ status: z.literal('Completed'), actualReturnDate: timestamp, finalOdometer: z.number().nonnegative() }),
])
export const paymentSchema = z.object({
  ...record, quotationId: id, amount: z.number().nonnegative(), currency: z.literal('LKR'),
  status: z.enum(['Pending', 'Succeeded', 'Failed']), simulated: z.literal(true),
  orderId: id.optional(), customerId: id.optional(), requestId: z.uuid().optional(),
  createdAt: timestamp.optional(), completedAt: timestamp.optional(), method: z.literal('Card').optional(),
  reference: z.string().optional(), failureReason: z.string().optional(),
  instrumentId: paymentInstrumentSchema.optional(), cardLast4: z.string().regex(/^\d{4}$/).optional(),
})
export const notificationSchema = z.object({ ...record, userId: id, message: z.string(), read: z.boolean(), createdAt: timestamp, simulated: z.literal(true), tripId: id.optional(), channel: z.literal('Push').optional(), deliveryState: z.literal('Queued locally').optional() })
export const chatMessageSchema = z.object({ ...record, senderId: id, recipientId: id, text: z.string(), createdAt: timestamp, simulated: z.literal(true), conversationId: id.optional(), orderId: id.optional(), readBy: z.array(id).default([]), deliveryState: z.literal('Stored locally').optional() })
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
  conversations: z.array(conversationSchema).default([]),
  mailMessages: z.array(mailMessageSchema).default([]),
  reportExports: z.array(reportExportSchema).default([]),
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
  if (data.orders.some((order) => order.pickupAt && order.deliveryBy && Date.parse(order.deliveryBy) < Date.parse(order.pickupAt))) invalid('Delivery deadline precedes pickup')
  const submissionKeys = data.orders.flatMap((order) => order.submissionKey ? [order.submissionKey] : [])
  if (new Set(submissionKeys).size !== submissionKeys.length) invalid('Duplicate order submission key')
  if (data.quotations.some((quote) => !data.orders.some((order) => order.id === quote.orderId))) invalid('Unknown quotation order')
  if (data.quotations.some((quote) => quote.charges && totalFare(quote.charges) !== quote.amount)) invalid('Quotation total does not match its charges')
  if (data.payments.some((payment) => !data.quotations.some((quote) => quote.id === payment.quotationId))) invalid('Unknown payment quotation')
  for (const payment of data.payments) {
    const quote = data.quotations.find((item) => item.id === payment.quotationId)
    const order = data.orders.find((item) => item.id === quote?.orderId)
    if ((payment.orderId && payment.orderId !== order?.id) || (payment.customerId && payment.customerId !== order?.customerId)) invalid('Invalid payment ownership')
    if (payment.requestId && (payment.amount !== quote?.amount || payment.currency !== quote.currency)) invalid('Invalid payment amount')
  }
  if (data.payments.some((payment) => payment.requestId && payment.status === 'Succeeded' && data.payments.some((other) => other.id !== payment.id && other.quotationId === payment.quotationId && other.status === 'Succeeded'))) invalid('Duplicate successful payment')
  if (data.quotations.some((quote) => quote.decidedBy && !data.customers.some((customer) => customer.userId === quote.decidedBy && data.orders.some((order) => order.id === quote.orderId && order.customerId === customer.id)))) invalid('Invalid quotation decision actor')
  const occupied = { vehicleId: new Set<string>(), driverId: new Set<string>(), mechanicId: new Set<string>() }
  for (const trip of data.trips) {
    if (!data.orders.some((order) => order.id === trip.orderId)) invalid('Unknown trip order')
    if (!!trip.scheduledStart !== !!trip.scheduledEnd || (trip.scheduledStart && trip.scheduledEnd && Date.parse(trip.scheduledEnd) <= Date.parse(trip.scheduledStart))) invalid('Invalid trip window')
    if (trip.createdBy && !userHasRole(trip.createdBy, 'coordinator')) invalid('Invalid trip creator')
    if ((trip.cancelledBy && !userHasRole(trip.cancelledBy, 'coordinator')) || (trip.completedBy && !userHasRole(trip.completedBy, 'coordinator'))) invalid('Invalid trip lifecycle actor')
    if (trip.status === 'Completed' && trip.startingOdometer !== undefined && trip.finalOdometer < trip.startingOdometer) invalid('Final odometer is below starting odometer')
    for (const [key, resources] of [['vehicleId', data.vehicles], ['driverId', data.drivers], ['mechanicId', data.mechanics]] as const) {
      const resource = resources.find((item) => item.id === trip.assignment[key])
      if (!resource) invalid('Unknown assigned resource')
      if (holdsTripResources(trip)) {
        if (occupied[key].has(trip.assignment[key]) || resource?.available) invalid('Conflicting resource assignment')
        occupied[key].add(trip.assignment[key])
      }
    }
  }
  const knownUser = (userId: string) => data.users.some((user) => user.id === userId)
  for (const conversation of data.conversations) {
    if (!data.orders.some((order) => order.id === conversation.orderId) || !knownUser(conversation.participantId) || conversationOwnerId(conversation) === conversation.participantId) invalid('Invalid conversation relationship')
    if (conversation.kind === 'CustomerStaff') {
      if (!userHasRole(conversation.customerUserId, 'customer') || !data.customers.some((customer) => customer.userId === conversation.customerUserId && data.orders.some((order) => order.id === conversation.orderId && order.customerId === customer.id)) || (!userHasRole(conversation.participantId, 'driver') && !userHasRole(conversation.participantId, 'mechanic'))) invalid('Invalid Customer staff conversation')
    } else if (!userHasRole(conversation.coordinatorId, 'coordinator')) invalid('Invalid conversation coordinator')
  }
  if (new Set(data.conversations.map((item) => JSON.stringify([item.orderId, conversationOwnerId(item), item.participantId]))).size !== data.conversations.length) invalid('Duplicate order conversation')
  for (const message of data.chatMessages) {
    if (message.conversationId) {
      const conversation = data.conversations.find((item) => item.id === message.conversationId)
      if (!conversation || message.orderId !== conversation.orderId || ![conversationOwnerId(conversation), conversation.participantId].includes(message.senderId) || ![conversationOwnerId(conversation), conversation.participantId].includes(message.recipientId) || message.senderId === message.recipientId) invalid('Invalid chat relationship')
    }
    if (message.readBy.some((userId) => userId !== message.senderId && userId !== message.recipientId)) invalid('Invalid message reader')
  }
  for (const mail of data.mailMessages) {
    const participants = [mail.senderId, ...mail.recipientIds]
    if (participants.some((userId) => !data.users.some((user) => user.id === userId && ['admin', 'coordinator'].includes(user.role))) || new Set(mail.recipientIds).size !== mail.recipientIds.length || (mail.status !== 'Draft' && !mail.recipientIds.length) || [...mail.readBy, ...mail.starredBy, ...mail.trashedBy].some((userId) => !participants.includes(userId))) invalid('Invalid internal mail participants')
    if ([mail.replyToId, mail.forwardedFromId].some((mailId) => mailId && !data.mailMessages.some((item) => item.id === mailId))) invalid('Unknown related mail')
  }
  if (data.reportExports.some((entry) => !userHasRole(entry.actorId, 'coordinator'))) invalid('Invalid report export actor')
  if (data.notifications.some((item) => item.tripId && !data.trips.some((trip) => trip.id === item.tripId))) invalid('Unknown notification trip')
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
