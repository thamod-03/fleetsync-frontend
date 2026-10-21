import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemoStore } from '../src/store/demo-store.ts'
import { createMockServices } from '../src/data/mock-services.ts'
import { unavailableAdapter } from '../src/services/unavailable-adapter.ts'
import type { Notification } from '../src/types/domain.ts'

function setup(delay = 0) {
  const saved = new Map<string, string>()
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value) } }
  const store = createDemoStore(storage)
  const users = store.getState().data.users
  const notifications: Notification[] = users.flatMap((user) => [
    { id: `older-${user.id}`, userId: user.id, message: 'Earlier update', read: true, createdAt: '2026-10-20T10:00:00.000Z', simulated: true },
    { id: `newer-${user.id}`, userId: user.id, message: 'New update', read: false, createdAt: '2026-10-21T10:00:00.000Z', simulated: true },
  ])
  store.setState({ data: { ...store.getState().data, notifications }, sessionUserId: 'user-customer', rememberSession: true })
  return { store, storage, services: createMockServices(store, delay) }
}

test('all user roles receive only their own notifications newest first, with detached results', async () => {
  const { store, services } = setup()
  for (const user of store.getState().data.users) {
    store.setState({ sessionUserId: user.id })
    const result = await services.getNotifications(); assert.ok(result.ok)
    assert.deepEqual(result.data.map((item) => item.id), [`newer-${user.id}`, `older-${user.id}`])
    result.data[0].read = true
    assert.equal(store.getState().data.notifications.find((item) => item.id === result.data[0].id)?.read, false)
  }
})

test('mark all read is scoped to the current account, persists and is idempotent', async () => {
  const { store, storage, services } = setup()
  assert.ok((await services.markAllNotificationsRead()).ok)
  assert.ok(store.getState().data.notifications.filter((item) => item.userId === 'user-customer').every((item) => item.read))
  assert.ok(store.getState().data.notifications.some((item) => item.userId !== 'user-customer' && !item.read))
  const data = store.getState().data
  assert.ok((await services.markAllNotificationsRead()).ok)
  assert.equal(store.getState().data, data)
  const restored = createDemoStore(storage)
  assert.deepEqual(restored.getState().data.notifications, data.notifications)
  await services.signIn('coordinator')
  const other = await services.getNotifications(); assert.ok(other.ok)
  assert.ok(other.data.some((item) => !item.read))
  await services.resetDemoData()
  assert.equal(store.getState().data.notifications.some((item) => item.id.startsWith('newer-')), false)
})

test('new notifications remain unread after a prior mark-all operation', async () => {
  const { store, services } = setup()
  await services.markAllNotificationsRead()
  const { data } = store.getState()
  store.setState({ data: { ...data, notifications: [...data.notifications, { id: 'incoming', userId: 'user-customer', message: 'Incoming update', read: false, createdAt: '2026-10-21T11:00:00.000Z', simulated: true }] } })
  const result = await services.getNotifications(); assert.ok(result.ok)
  assert.deepEqual(result.data.filter((item) => !item.read).map((item) => item.id), ['incoming'])
})

test('notifications reject logged-out, pending and switched sessions without changing records', async () => {
  const { store, services } = setup(10)
  const before = store.getState().data.notifications
  const pendingRead = services.getNotifications()
  const pendingMark = services.markAllNotificationsRead()
  store.setState({ sessionUserId: 'user-admin' })
  assert.equal((await pendingRead).ok, false)
  assert.equal((await pendingMark).ok, false)
  assert.equal(store.getState().data.notifications, before)
  store.setState({ sessionUserId: null })
  assert.equal((await services.getNotifications()).ok, false)
  assert.equal((await services.markAllNotificationsRead()).ok, false)
  const data = store.getState().data
  store.setState({ sessionUserId: 'user-customer', data: { ...data, users: data.users.map((user) => user.id === 'user-customer' ? { ...user, accountStatus: 'Pending' } : user) } })
  assert.equal((await services.getNotifications()).ok, false)
  assert.equal((await services.markAllNotificationsRead()).ok, false)
  assert.equal((await unavailableAdapter.services.getNotifications()).ok, false)
  assert.equal((await unavailableAdapter.services.markAllNotificationsRead()).ok, false)
})
