import { demoDatasetSchema, type DemoDataset } from '../types/domain.ts'

// All identities, registrations, companies and transactions are fictional.
const seed: DemoDataset = {
  customerRegistrations: [], staffApplications: [], loginAttempts: [],
  users: [
    { id: 'user-admin', name: 'Alex Silva', email: 'alex@fleetsync.example', role: 'admin' },
    { id: 'user-customer', name: 'Maya Fernando', email: 'maya@harbor.example', role: 'customer' },
    { id: 'user-coordinator', name: 'Ravi Perera', email: 'ravi@fleetsync.example', role: 'coordinator' },
    { id: 'user-driver-1', name: 'Nilan Dias', email: 'nilan@fleetsync.example', role: 'driver' },
    { id: 'user-driver-2', name: 'Samira Deen', email: 'samira@fleetsync.example', role: 'driver' },
    { id: 'user-mechanic-1', name: 'Dev Senaka', email: 'dev@fleetsync.example', role: 'mechanic' },
    { id: 'user-mechanic-2', name: 'Anu Jay', email: 'anu@fleetsync.example', role: 'mechanic' },
  ],
  customerCompanies: [{ id: 'company-harbor', name: 'Harbor Paperworks (Demo)' }],
  customers: [{ id: 'customer-maya', userId: 'user-customer', companyId: 'company-harbor' }],
  vehicles: [
    { id: 'vehicle-1', registration: 'DEMO-001', description: 'Box truck', available: false },
    { id: 'vehicle-2', registration: 'DEMO-002', description: 'Cargo van', available: true },
  ],
  drivers: [{ id: 'driver-1', userId: 'user-driver-1', available: false }, { id: 'driver-2', userId: 'user-driver-2', available: true }],
  mechanics: [{ id: 'mechanic-1', userId: 'user-mechanic-1', available: false }, { id: 'mechanic-2', userId: 'user-mechanic-2', available: true }],
  orders: [
    { id: 'order-001', customerId: 'customer-maya', origin: 'Colombo', destination: 'Galle', cargo: 'Paper cartons', status: 'Accepted', createdAt: '2026-10-18T04:00:00Z' },
    { id: 'order-002', customerId: 'customer-maya', origin: 'Colombo', destination: 'Kandy', cargo: 'Office supplies', status: 'Submitted', createdAt: '2026-10-19T04:00:00Z' },
  ],
  quotations: [{ id: 'quotation-001', orderId: 'order-001', amount: 24000, currency: 'LKR', status: 'Accepted' }],
  trips: [{ id: 'trip-001', orderId: 'order-001', status: 'Assigned', assignment: { vehicleId: 'vehicle-1', driverId: 'driver-1', mechanicId: 'mechanic-1' } }],
  payments: [{ id: 'payment-001', quotationId: 'quotation-001', amount: 24000, currency: 'LKR', status: 'Succeeded', simulated: true }],
  notifications: [{ id: 'notification-001', userId: 'user-customer', message: 'Demo trip trip-001 has been assigned.', read: false, createdAt: '2026-10-19T05:00:00Z', simulated: true }],
  chatMessages: [{ id: 'message-001', senderId: 'user-customer', recipientId: 'user-coordinator', text: 'Demo message: cartons will be ready for collection.', createdAt: '2026-10-19T05:10:00Z', simulated: true }],
  auditEvents: [{ id: 'audit-001', actorId: 'user-coordinator', action: 'Demo trip assigned', entityId: 'trip-001', createdAt: '2026-10-19T05:00:00Z' }],
}

export function createSeedData(): DemoDataset {
  return demoDatasetSchema.parse(structuredClone(seed))
}
