import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemoStore } from '../src/store/demo-store.ts'
import { createMockServices } from '../src/data/mock-services.ts'
import { createCommunicationServices } from '../src/data/communication-services.ts'
import { createSeedData } from '../src/data/seed.ts'
import { DEMO_STORAGE_KEY, type StoragePort } from '../src/lib/demo-storage.ts'
import { demoDatasetSchema, type Trip } from '../src/types/domain.ts'
import { reportCsv } from '../src/lib/report-export.ts'
import { reportFiltersSchema, type ReportFilters } from '../src/types/reporting.ts'

const filters: ReportFilters = { type: 'Trip summary', start: '2026-10-01', end: '2026-10-31', base: '', customerId: '' }
const conversationId = 'conversation-order-001-user-coordinator-user-customer'
function setup() {
  const saved = new Map<string, string>()
  const storage: StoragePort = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => { saved.set(key, value) } }
  const store = createDemoStore(storage)
  store.setState({ sessionUserId: 'user-coordinator', rememberSession: true })
  return { store, storage, services: createMockServices(store, 0) }
}

test('reports filter saved records, completed odometers, status counts and nonduplicated payments', async () => {
  const { store, services } = setup()
  const { data } = store.getState()
  const completed: Trip = { ...data.trips[0]!, status: 'Completed', startingOdometer: 1000, actualReturnDate: '2026-10-20T08:00:00Z', finalOdometer: 1125 }
  const cancelled: Trip = { ...data.trips[0]!, id: 'trip-cancelled', status: 'Cancelled', assignment: { vehicleId: 'vehicle-2', driverId: 'driver-2', mechanicId: 'mechanic-2' }, cancelledAt: '2026-10-21T08:00:00Z' }
  store.setState({ data: { ...data, trips: [completed, cancelled] } })
  const result = await services.generateReport(filters)
  assert.ok(result.ok)
  assert.deepEqual(result.data.cards.map((card) => card.value), ['1', '1', '125 km', 'LKR 24,000'])
  assert.deepEqual(result.data.chart, [{ date: '2026-10-20', completed: 1 }])
  const total = result.data.rows.find((row) => row.id === '__total')!
  assert.deepEqual(total.cells, ['Total', '2', '125 km', '24,000', '1'])
  assert.ok(result.data.rows.filter((row) => row.id !== '__total').every((row) => row.cells[3] === 'Not attributable'))
  const before = await services.generateReport({ ...filters, end: '2026-10-19' })
  assert.ok(before.ok)
  assert.deepEqual(before.data.rows, [])
  const after = await services.generateReport({ ...filters, start: '2026-10-21' })
  assert.ok(after.ok)
  assert.equal(after.data.cards[0]!.value, '0')
  assert.equal(after.data.cards[1]!.value, '1')
  assert.equal((await services.generateReport({ ...filters, base: 'missing' })).ok, false)
  assert.equal((await services.generateReport({ ...filters, customerId: 'missing' })).ok, false)
})

test('report categories use shared assignments and orders; invalid/empty periods and missing readings are handled', async () => {
  const { store, services } = setup()
  assert.equal(reportFiltersSchema.safeParse({ ...filters, start: '2026-02-30' }).success, false)
  assert.equal((await services.generateReport({ ...filters, end: '2026-09-30' })).ok, false)
  const drivers = await services.generateReport({ ...filters, type: 'Driver activity' })
  assert.ok(drivers.ok)
  assert.equal(drivers.data.rows.find((row) => row.id === 'driver-1')?.cells[1], '1')
  const vehicles = await services.generateReport({ ...filters, type: 'Vehicle utilisation', base: 'Colombo depot', customerId: 'customer-maya' })
  assert.ok(vehicles.ok)
  assert.deepEqual(vehicles.data.rows[0]?.cells, ['DEMO-001', '1', '0', 'Not recorded', '0 km'])
  const orders = await services.generateReport({ ...filters, type: 'Orders and payments' })
  assert.ok(orders.ok)
  assert.equal(orders.data.rows.length, 2)
  assert.equal(orders.data.rows.find((row) => row.id === 'order-001')?.cells[4], 'Paid')
  const { data } = store.getState()
  store.setState({ data: { ...data, trips: [{ ...data.trips[0]!, status: 'Completed', actualReturnDate: '2026-10-20T08:00:00Z', finalOdometer: 1000 }] } })
  const unknown = await services.generateReport(filters)
  assert.ok(unknown.ok)
  assert.equal(unknown.data.cards[2]!.value, 'Not recorded')
  const empty = await services.generateReport({ ...filters, start: '2025-01-01', end: '2025-01-31' })
  assert.ok(empty.ok)
  assert.deepEqual(empty.data.rows, [])
  assert.deepEqual(empty.data.chart, [])
  await services.signIn('customer')
  assert.equal((await services.generateReport(filters)).ok, false)
  assert.equal((await services.getReportContext()).ok, false)
})

test('exports preserve the displayed snapshot, CSV values, filters, safety and reload/reset history', async () => {
  const { store, storage, services } = setup()
  const { data } = store.getState()
  store.setState({ data: { ...data, customerCompanies: [{ ...data.customerCompanies[0]!, name: '=HYPERLINK("unsafe")' }] } })
  const result = await services.generateReport({ ...filters, type: 'Orders and payments' })
  assert.ok(result.ok)
  const csv = reportCsv(result.data)
  assert.ok(csv.includes('"\'=HYPERLINK(""unsafe"")"'))
  for (const row of result.data.rows) for (const cell of row.cells.filter((value) => !value.startsWith('='))) assert.ok(csv.includes(`"${cell.replaceAll('"', '""')}"`))
  assert.ok(csv.includes('2026-10-01 to 2026-10-31'))
  assert.ok(csv.includes('Payments have no recorded timestamps'))
  const saved = await services.recordReportExport(result.data, 'CSV')
  assert.ok(saved.ok)
  assert.equal(saved.data.filename, 'fleetsync-orders-and-payments-2026-10-01-to-2026-10-31.csv')
  assert.deepEqual(createDemoStore(storage).getState().data.reportExports[0]?.report, result.data)
  await services.signIn('customer')
  assert.equal((await services.recordReportExport(result.data, 'PDF')).ok, false)
  await services.resetDemoData()
  assert.deepEqual(store.getState().data.reportExports, [])
})

test('chat room people derive from orders and current three-resource assignments', async () => {
  const { services } = setup()
  const result = await services.getChatWorkspace()
  assert.ok(result.ok)
  const assigned = result.data.rooms.find((room) => room.order.id === 'order-001')!
  assert.equal(assigned.tripId, 'trip-001')
  assert.deepEqual(assigned.conversations.map((item) => item.peer.role).sort(), ['customer', 'driver', 'mechanic'])
  assert.deepEqual(result.data.rooms.find((room) => room.order.id === 'order-002')?.conversations.map((item) => item.peer.role), ['customer'])
  const trip = await services.createTrip({ orderId: 'order-002', assignment: { vehicleId: 'vehicle-2', driverId: 'driver-2', mechanicId: 'mechanic-2' } })
  assert.ok(trip.ok)
  const updated = await services.getChatWorkspace()
  assert.ok(updated.ok)
  assert.deepEqual(updated.data.rooms.find((room) => room.order.id === 'order-002')?.conversations.map((item) => item.peer.id), ['user-customer', 'user-driver-2', 'user-mechanic-2'])
})

test('chat validates text, persists relationships and queues one notification for concurrent request retries', async () => {
  const { store, storage, services } = setup()
  const before = store.getState().data.notifications.length
  for (const text of ['', '  ', 'x'.repeat(4001)]) assert.equal((await services.sendChatMessage({ conversationId, text })).ok, false)
  assert.equal((await services.sendChatMessage({ conversationId: 'missing', text: 'Hello' })).ok, false)
  const input = { conversationId, messageId: 'message-retry', text: '  Collection confirmed.  ' }
  const results = await Promise.all([services.sendChatMessage(input), services.sendChatMessage(input)])
  assert.ok(results.every((result) => result.ok))
  assert.equal(store.getState().data.chatMessages.filter((item) => item.id === 'message-retry').length, 1)
  assert.equal(store.getState().data.notifications.length, before + 1)
  const message = createDemoStore(storage).getState().data.chatMessages.find((item) => item.id === 'message-retry')!
  assert.equal(message.orderId, 'order-001')
  assert.equal(message.senderId, 'user-coordinator')
  assert.equal(message.recipientId, 'user-customer')
  assert.equal(message.text, 'Collection confirmed.')
  assert.equal(message.deliveryState, 'Stored locally')
  assert.equal((await services.sendChatMessage({ ...input, text: 'Changed retry' })).ok, false)
  await services.getChatWorkspace(); await services.getConversation(conversationId)
  assert.equal(store.getState().data.notifications.length, before + 1)
  assert.equal(demoDatasetSchema.safeParse(store.getState().data).success, true)
})

test('chat is shared across roles and unread state is local, authorized and idempotent', async () => {
  const { store, services } = setup()
  const sent = await services.sendChatMessage({ conversationId, text: 'Please confirm collection.' })
  assert.ok(sent.ok)
  await services.signIn('customer')
  const history = await services.getConversation(conversationId)
  assert.ok(history.ok)
  assert.equal(history.data.messages.at(-1)?.id, sent.data.id)
  assert.equal(history.data.unread, 1)
  const notificationCount = store.getState().data.notifications.length
  await services.markConversationRead(conversationId); await services.markConversationRead(conversationId)
  const read = await services.getConversation(conversationId)
  assert.ok(read.ok)
  assert.equal(read.data.unread, 0)
  assert.equal(store.getState().data.notifications.length, notificationCount)
  assert.ok((await services.sendChatMessage({ conversationId, text: 'Confirmed.' })).ok)
  store.setState({ sessionUserId: 'user-driver-2' })
  assert.equal((await services.getConversation(conversationId)).ok, false)
  assert.equal((await services.sendChatMessage({ conversationId, text: 'Unrelated driver' })).ok, false)
  assert.equal((await services.markConversationRead(conversationId)).ok, false)
  store.setState({ sessionUserId: 'user-driver-1' })
  const staff = await services.getChatWorkspace()
  assert.ok(staff.ok)
  assert.equal(staff.data.rooms.length, 1)
  assert.equal(staff.data.rooms[0]?.conversations[0]?.peer.id, 'user-coordinator')
  assert.equal((await services.getConversation(conversationId)).ok, false)
  store.setState({ sessionUserId: 'user-mechanic-1' })
  const mechanic = await services.getChatWorkspace()
  assert.ok(mechanic.ok)
  const mechanicPair = mechanic.data.rooms[0]!.conversations[0]!
  assert.ok((await services.sendChatMessage({ conversationId: mechanicPair.id, text: 'Vehicle inspection recorded.' })).ok)
  const { data } = store.getState()
  store.setState({ sessionUserId: 'user-unrelated-customer', data: { ...data,
    users: [...data.users, { id: 'user-unrelated-customer', name: 'Other Contact', email: 'other@fictional.example', role: 'customer' }],
    customers: [...data.customers, { id: 'customer-other', userId: 'user-unrelated-customer', companyId: 'company-harbor' }],
  } })
  const unrelated = await services.getChatWorkspace()
  assert.ok(unrelated.ok)
  assert.deepEqual(unrelated.data.rooms, [])
  assert.equal((await services.getConversation(conversationId)).ok, false)
  assert.equal((await services.sendChatMessage({ conversationId, text: 'Unrelated contact' })).ok, false)
  await services.logout()
  assert.equal((await services.getChatWorkspace()).ok, false)
})

test('internal mail drafts are private, validation is strict and send/retry persists atomically', async () => {
  const { store, storage, services } = setup()
  const input = { id: 'mail-retry', recipientIds: ['user-admin'], subject: 'Weekly review', body: 'Please review the assigned trips.' }
  assert.equal((await services.saveMail({ ...input, body: ' ' }, false)).ok, false)
  assert.equal((await services.saveMail({ ...input, recipientIds: ['user-customer'] }, false)).ok, false)
  assert.equal((await services.saveMail({ ...input, recipientIds: ['user-admin', 'user-admin'] }, true)).ok, false)
  assert.equal((await services.saveMail({ ...input, replyToId: 'unknown' }, false)).ok, false)
  assert.ok((await services.saveMail(input, true)).ok)
  const count = store.getState().data.notifications.length
  await services.signIn('admin')
  const privateDrafts = await services.getMailbox()
  assert.ok(privateDrafts.ok)
  assert.equal(privateDrafts.data.messages.some((item) => item.id === input.id), false)
  assert.equal((await services.setMailFlag(input.id, 'read', true)).ok, false)
  assert.equal((await services.saveMail(input, false)).ok, false)
  await services.signIn('coordinator')
  const results = await Promise.all([services.saveMail(input, false), services.saveMail(input, false)])
  assert.ok(results.every((result) => result.ok))
  assert.equal(store.getState().data.notifications.length, count + 1)
  const restored = createDemoStore(storage).getState().data.mailMessages.find((item) => item.id === input.id)!
  assert.equal(restored.status, 'Stored locally')
  assert.equal(restored.senderId, 'user-coordinator')
  assert.deepEqual(restored.recipientIds, ['user-admin'])
  assert.equal((await services.saveMail({ ...input, body: 'Edited stored mail' }, false)).ok, false)
  await services.signIn('customer')
  assert.equal((await services.getMailbox()).ok, false)
  assert.equal((await services.saveMail(input, false)).ok, false)
})

test('mail read, star, trash, reply/forward relationships and notifications remain per user', async () => {
  const { store, services } = setup()
  const initial = await services.getMailbox()
  assert.ok(initial.ok)
  assert.equal(initial.data.messages[0]?.readBy.includes('user-coordinator'), false)
  const before = store.getState().data.notifications.length
  await services.setMailFlag('mail-001', 'read', true); await services.setMailFlag('mail-001', 'read', true)
  await services.setMailFlag('mail-001', 'starred', true); await services.setMailFlag('mail-001', 'trash', true)
  const changed = store.getState().data.mailMessages[0]!
  assert.deepEqual(changed.trashedBy, ['user-coordinator'])
  assert.deepEqual(changed.starredBy, ['user-coordinator'])
  assert.ok(changed.readBy.includes('user-admin') && changed.readBy.includes('user-coordinator'))
  await services.setMailFlag('mail-001', 'trash', false); await services.setMailFlag('mail-001', 'read', false)
  assert.equal(store.getState().data.mailMessages[0]?.readBy.includes('user-coordinator'), false)
  assert.equal(store.getState().data.notifications.length, before)
  const reply = await services.saveMail({ recipientIds: ['user-admin'], subject: 'Re: Weekly operational review', body: 'The order review is ready.', replyToId: 'mail-001' }, false)
  assert.ok(reply.ok)
  const forward = await services.saveMail({ recipientIds: ['user-admin'], subject: 'Fwd: Weekly operational review', body: 'Please see the review.', forwardedFromId: 'mail-001' }, false)
  assert.ok(forward.ok)
  await services.signIn('admin')
  const admin = await services.getMailbox()
  assert.ok(admin.ok)
  assert.ok(admin.data.messages.some((item) => item.id === reply.data.id && item.replyToId === 'mail-001'))
  assert.equal(store.getState().data.notifications.length, before + 2)
  assert.equal(demoDatasetSchema.safeParse(store.getState().data).success, true)
})

test('notification preparation failure prevents partial chat or mail saves', async () => {
  const { store } = setup()
  const services = createCommunicationServices(store, 0, { prepare: () => { throw new Error('Offline notifier') } })
  const before = structuredClone(store.getState().data)
  assert.equal((await services.sendChatMessage({ conversationId, text: 'Hello' })).ok, false)
  assert.equal((await services.saveMail({ recipientIds: ['user-admin'], subject: 'Review', body: 'Please review.' }, false)).ok, false)
  assert.deepEqual(store.getState().data, before)
})

test('legacy snapshots retain unscoped messages without guessing order identity, and Reset restores all new collections', async () => {
  const { store, storage, services } = setup()
  const { conversations, mailMessages, reportExports, ...legacy } = createSeedData()
  assert.ok(conversations.length && mailMessages.length && !reportExports.length)
  const original = legacy.chatMessages[0]!
  const raw = { ...legacy, chatMessages: [{ id: original.id, senderId: original.senderId, recipientId: original.recipientId, text: 'Previously saved unscoped message', createdAt: original.createdAt, simulated: true }] }
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ version: 1, data: raw, sessionUserId: 'user-coordinator' }))
  const restored = createDemoStore(storage).getState()
  assert.equal(restored.storageNotice, null)
  assert.equal(restored.data.chatMessages[0]?.text, 'Previously saved unscoped message')
  assert.deepEqual(restored.data.conversations, [])
  assert.deepEqual(restored.data.mailMessages, [])
  assert.deepEqual(restored.data.reportExports, [])
  assert.deepEqual(restored.data.orders, legacy.orders)
  await services.sendChatMessage({ conversationId, text: 'New message' })
  await services.saveMail({ recipientIds: ['user-admin'], subject: 'Review', body: 'A new message.' }, false)
  await services.resetDemoData()
  assert.deepEqual(store.getState().data, createSeedData())
  assert.deepEqual(createDemoStore(storage).getState().data, createSeedData())
})
