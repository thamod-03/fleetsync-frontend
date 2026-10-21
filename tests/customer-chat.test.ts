import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemoStore } from '../src/store/demo-store.ts'
import { createMockServices } from '../src/data/mock-services.ts'
import { createSeedData } from '../src/data/seed.ts'
import { createCommunicationServices } from '../src/data/communication-services.ts'
import type { SendChatInput } from '../src/types/communications.ts'
import { demoDatasetSchema } from '../src/types/domain.ts'
import type { StoragePort } from '../src/lib/demo-storage.ts'

const conversationId = 'conversation-order-001-user-coordinator-user-customer'
function setup() {
  const saved = new Map<string, string>()
  const storage: StoragePort = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => { saved.set(key, value) } }
  const store = createDemoStore(storage)
  store.setState({ sessionUserId: 'user-customer', rememberSession: true })
  return { store, storage, services: createMockServices(store, 0) }
}

test('Customer workspace uses owned orders and actual assignment context without disclosing Coordinator–staff messages', async () => {
  const { store, services } = setup()
  const workspace = await services.getChatWorkspace(); assert.ok(workspace.ok)
  assert.deepEqual(workspace.data.rooms.map((room) => room.order.id), ['order-001', 'order-002'])
  const assigned = workspace.data.rooms[0]
  assert.equal(assigned.assignmentContext?.driver?.id, 'user-driver-1')
  assert.equal(assigned.assignmentContext?.mechanic?.id, 'user-mechanic-1')
  assert.equal(assigned.assignmentContext?.vehicleRegistration, 'DEMO-001')
  assert.equal(workspace.data.rooms[1].assignmentContext, undefined)
  assert.deepEqual(assigned.conversations.map((conversation) => conversation.peer.role), ['coordinator', 'driver', 'mechanic'])
  store.setState({ sessionUserId: 'user-coordinator' })
  const coordinator = await services.getChatWorkspace(); assert.ok(coordinator.ok)
  const staffPair = coordinator.data.rooms[0].conversations.find((conversation) => conversation.peer.role === 'driver')!
  assert.ok((await services.sendChatMessage({ conversationId: staffPair.id, text: 'Private staff instructions.' })).ok)
  store.setState({ sessionUserId: 'user-customer' })
  assert.equal((await services.getConversation(staffPair.id)).ok, false)
  assert.equal((await services.sendChatMessage({ conversationId: staffPair.id, text: 'Unauthorized' })).ok, false)
  const updated = await services.getChatWorkspace(); assert.ok(updated.ok)
  assert.equal(JSON.stringify(updated.data).includes('Private staff instructions.'), false)
})

test('same-company customers and forged conversation identifiers cannot read, send or mark someone else’s conversation', async () => {
  const { store, services } = setup(); const data = store.getState().data
  store.setState({ data: { ...data, users: [...data.users, { id: 'other-user', role: 'customer', name: 'Other Contact', email: 'other@example.test' }], customers: [...data.customers, { id: 'other-profile', userId: 'other-user', companyId: 'company-harbor' }] }, sessionUserId: 'other-user' })
  const workspace = await services.getChatWorkspace(); assert.ok(workspace.ok); assert.deepEqual(workspace.data.rooms, [])
  for (const result of await Promise.all([services.getConversation(conversationId), services.sendChatMessage({ conversationId, text: 'Unauthorized', messageId: 'unowned-message' }), services.markConversationRead(conversationId)])) assert.equal(result.ok, false)
  assert.equal((await services.getConversation('unknown-order-conversation')).ok, false)
  store.setState({ sessionUserId: 'user-admin' }); assert.equal((await services.getChatWorkspace()).ok, false)
  await services.logout(); assert.equal((await services.getConversation(conversationId)).ok, false)
})

test('senders, recipients and order associations are derived from the authenticated pair, not submitted fields', async () => {
  const { services } = setup()
  const input = { conversationId, messageId: 'customer-spoof-test', text: '  Collection details confirmed.  ', senderId: 'user-admin', recipientId: 'user-driver-1', orderId: 'order-002' } as SendChatInput
  const sent = await services.sendChatMessage(input); assert.ok(sent.ok)
  assert.equal(sent.data.senderId, 'user-customer'); assert.equal(sent.data.recipientId, 'user-coordinator')
  assert.equal(sent.data.orderId, 'order-001'); assert.equal(sent.data.text, 'Collection details confirmed.')
  assert.equal(sent.data.deliveryState, 'Stored locally')
})

test('Customer–Coordinator history is shared in both directions and persists ordered messages and local unread state', async () => {
  const { services, store, storage } = setup()
  const customer = await services.sendChatMessage({ conversationId, messageId: 'customer-first', text: 'Please confirm the pickup.' }); assert.ok(customer.ok)
  await services.signIn('coordinator')
  const coordinatorView = await services.getConversation(conversationId); assert.ok(coordinatorView.ok)
  assert.equal(coordinatorView.data.messages.at(-1)?.id, customer.data.id); assert.ok(coordinatorView.data.unread > 0)
  const reply = await services.sendChatMessage({ conversationId, messageId: 'coordinator-reply', text: 'Pickup confirmed.' }); assert.ok(reply.ok)
  await services.signIn('customer')
  const customerView = await services.getConversation(conversationId); assert.ok(customerView.ok)
  assert.deepEqual(customerView.data.messages.slice(-2).map((message) => message.id), ['customer-first', 'coordinator-reply'])
  assert.equal(customerView.data.unread, 1)
  const noticeCount = store.getState().data.notifications.length
  assert.ok((await services.markConversationRead(conversationId)).ok); assert.ok((await services.markConversationRead(conversationId)).ok)
  assert.equal(store.getState().data.notifications.length, noticeCount)
  const restored = createDemoStore(storage); assert.equal(restored.getState().storageNotice, null)
  const reloaded = await createMockServices(restored, 0).getConversation(conversationId); assert.ok(reloaded.ok)
  assert.equal(reloaded.data.unread, 0)
  const beforeReload = await services.getConversation(conversationId); assert.ok(beforeReload.ok)
  assert.deepEqual(reloaded.data.messages, beforeReload.data.messages)
  assert.ok(demoDatasetSchema.safeParse(restored.getState().data).success)
})

test('validation and duplicate retries preserve one message and one recipient notification, including after reload', async () => {
  const { services, store, storage } = setup()
  const baseline = store.getState().data.notifications.length
  for (const text of ['', ' \n ', 'x'.repeat(4001)]) assert.equal((await services.sendChatMessage({ conversationId, text })).ok, false)
  const input = { conversationId, messageId: 'customer-retry', text: 'Please use the loading bay.' }
  const results = await Promise.all([services.sendChatMessage(input), services.sendChatMessage(input)])
  assert.ok(results.every((result) => result.ok))
  assert.equal(store.getState().data.chatMessages.filter((message) => message.id === input.messageId).length, 1)
  assert.equal(store.getState().data.notifications.length, baseline + 1)
  assert.equal(store.getState().data.notifications.at(-1)?.userId, 'user-coordinator')
  const restored = createDemoStore(storage); const reloaded = createMockServices(restored, 0)
  assert.ok((await reloaded.sendChatMessage(input)).ok)
  assert.equal(restored.getState().data.notifications.length, baseline + 1)
  assert.equal((await reloaded.sendChatMessage({ ...input, text: 'Different content' })).ok, false)
  const beforeQueries = restored.getState().data.notifications.length
  await reloaded.getChatWorkspace(); await reloaded.getConversation(conversationId)
  assert.equal(restored.getState().data.notifications.length, beforeQueries)
})

test('persona changes during save do not impersonate the new account and ownership is rechecked at commit', async () => {
  const { store } = setup(); const services = createCommunicationServices(store, 20)
  const before = structuredClone(store.getState().data)
  const sending = services.sendChatMessage({ conversationId, text: 'Written by customer before persona change.' })
  store.setState({ sessionUserId: 'user-coordinator' })
  assert.equal((await sending).ok, false)
  assert.deepEqual(store.getState().data, before)
  store.setState({ sessionUserId: 'user-customer' })
  const invalidated = services.sendChatMessage({ conversationId, text: 'Order no longer belongs to customer.' })
  const data = store.getState().data
  store.setState({ data: { ...data, orders: data.orders.map((order) => order.id === 'order-001' ? { ...order, status: 'Draft' } : order) } })
  assert.equal((await invalidated).ok, false)
})

test('failed notification preparation is atomic; Reset restores canonical conversations, messages and notices', async () => {
  const { store, services, storage } = setup()
  const before = structuredClone(store.getState().data)
  const broken = createCommunicationServices(store, 0, { prepare() { throw new Error('Notification preparation failed') } })
  assert.equal((await broken.sendChatMessage({ conversationId, text: 'Must not partially save.' })).ok, false)
  assert.deepEqual(store.getState().data, before)
  assert.ok((await services.sendChatMessage({ conversationId, messageId: 'reset-customer-message', text: 'Temporary message.' })).ok)
  await services.resetDemoData()
  assert.deepEqual(store.getState().data, createSeedData())
  assert.deepEqual(createDemoStore(storage).getState().data, createSeedData())
})

test('room metadata follows new assignments, while unassigned orders have no invented driver or mechanic', async () => {
  const { services, store } = setup()
  store.setState({ sessionUserId: 'user-coordinator' })
  assert.ok((await services.createTrip({ orderId: 'order-002', assignment: { vehicleId: 'vehicle-2', driverId: 'driver-2', mechanicId: 'mechanic-2' } })).ok)
  store.setState({ sessionUserId: 'user-customer' })
  const workspace = await services.getChatWorkspace(); assert.ok(workspace.ok)
  const assigned = workspace.data.rooms.find((room) => room.order.id === 'order-002')
  assert.equal(assigned?.assignmentContext?.driver?.id, 'user-driver-2')
  assert.equal(assigned?.assignmentContext?.mechanic?.id, 'user-mechanic-2')
  assert.deepEqual(assigned?.conversations.map((conversation) => conversation.peer.id), ['user-coordinator', 'user-driver-2', 'user-mechanic-2'])
})

test('history sorts persisted records by timestamp even when storage insertion order differs', async () => {
  const { store, services, storage } = setup(); const data = store.getState().data
  const message = { conversationId, orderId: 'order-001', senderId: 'user-customer', recipientId: 'user-coordinator', simulated: true as const, readBy: ['user-customer'], deliveryState: 'Stored locally' as const }
  store.setState({ data: { ...data, chatMessages: [...data.chatMessages,
    { ...message, id: 'ordered-later', text: 'Later', createdAt: '2030-10-21T12:00:00Z' },
    { ...message, id: 'ordered-earlier', text: 'Earlier', createdAt: '2030-10-21T11:00:00Z' },
  ] } })
  const history = await services.getConversation(conversationId); assert.ok(history.ok)
  assert.deepEqual(history.data.messages.slice(-2).map((item) => item.id), ['ordered-earlier', 'ordered-later'])
  const reloaded = await createMockServices(createDemoStore(storage), 0).getConversation(conversationId); assert.ok(reloaded.ok)
  assert.deepEqual(reloaded.data.messages, history.data.messages)
})

test('Customer chats with assigned Driver and Mechanic use private pairs and survive reload', async () => {
  const { services, store, storage } = setup()
  const workspace = await services.getChatWorkspace(); assert.ok(workspace.ok)
  const peers = workspace.data.rooms[0].conversations.filter((pair) => pair.kind === 'CustomerStaff')
  assert.deepEqual(peers.map((pair) => pair.peer.role), ['driver', 'mechanic'])
  for (const pair of peers) {
    const sent = await services.sendChatMessage({ conversationId: pair.id, messageId: `direct-${pair.peer.id}`, text: `Hello ${pair.peer.role}.` }); assert.ok(sent.ok)
    assert.equal(sent.data.recipientId, pair.peer.id)
    store.setState({ sessionUserId: 'user-coordinator' }); assert.equal((await services.getConversation(pair.id)).ok, false)
    store.setState({ sessionUserId: pair.peer.id })
    const received = await services.getConversation(pair.id); assert.ok(received.ok); assert.equal(received.data.messages.at(-1)?.id, sent.data.id)
    assert.ok((await services.sendChatMessage({ conversationId: pair.id, text: 'Acknowledged locally.' })).ok)
    store.setState({ sessionUserId: 'user-customer' })
    const reply = await services.getConversation(pair.id); assert.ok(reply.ok); assert.equal(reply.data.messages.at(-1)?.text, 'Acknowledged locally.')
  }
  const restored = createDemoStore(storage); assert.equal(restored.getState().storageNotice, null)
  assert.ok(demoDatasetSchema.safeParse(restored.getState().data).success)
  for (const pair of peers) assert.ok((await createMockServices(restored, 0).getConversation(pair.id)).ok)
  store.setState({ sessionUserId: 'user-driver-2' }); assert.equal((await services.getConversation(peers[0].id)).ok, false)
})
