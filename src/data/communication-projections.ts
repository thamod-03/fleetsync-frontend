import type { DemoDataset, User } from '../types/domain.ts'
import type { ChatWorkspace, Conversation, OrderRoom } from '../types/communications.ts'
import { conversationOwnerId } from '../types/communications.ts'

export function orderConversations(data: DemoDataset): Conversation[] {
  return data.orders.filter((order) => order.status !== 'Draft').flatMap((order) => {
    const customer = data.customers.find((item) => item.id === order.customerId)
    const trips = data.trips.filter((item) => item.orderId === order.id).slice().reverse()
    const trip = trips.find((item) => ['Assigned', 'In Progress'].includes(item.status)) ?? trips[0]
    const participantIds = [customer?.userId, data.drivers.find((item) => item.id === trip?.assignment.driverId)?.userId, data.mechanics.find((item) => item.id === trip?.assignment.mechanicId)?.userId]
    const coordinatorPairs: Conversation[] = data.users.filter((user) => user.role === 'coordinator' && user.accountStatus !== 'Pending').flatMap((coordinator) => participantIds.flatMap((participantId) => {
      if (!participantId || !data.users.some((user) => user.id === participantId && user.accountStatus !== 'Pending')) return []
      const saved = data.conversations.find((item) => item.orderId === order.id && item.coordinatorId === coordinator.id && item.participantId === participantId)
      return [saved ?? { id: `conversation-${order.id}-${coordinator.id}-${participantId}`, orderId: order.id, coordinatorId: coordinator.id, participantId }]
    }))
    const customerPairs: Conversation[] = customer && data.users.some((user) => user.id === customer.userId && user.accountStatus !== 'Pending') ? participantIds.slice(1).flatMap((participantId) => {
      if (!participantId || !data.users.some((user) => user.id === participantId && user.accountStatus !== 'Pending')) return []
      const saved = data.conversations.find((item) => item.kind === 'CustomerStaff' && item.orderId === order.id && item.customerUserId === customer.userId && item.participantId === participantId)
      return [saved ?? { id: `conversation-${order.id}-${customer.userId}-${participantId}`, kind: 'CustomerStaff' as const, orderId: order.id, customerUserId: customer.userId, participantId }]
    }) : []
    return [...coordinatorPairs, ...customerPairs]
  })
}

export function chatWorkspace(data: DemoDataset, user: User): ChatWorkspace {
  const conversations = orderConversations(data).filter((item) => [conversationOwnerId(item), item.participantId].includes(user.id))
  const rooms: OrderRoom[] = data.orders.flatMap((order) => {
    const matches = conversations.filter((item) => item.orderId === order.id)
    if (!matches.length) return []
    const customer = data.customers.find((item) => item.id === order.customerId)
    const company = data.customerCompanies.find((item) => item.id === customer?.companyId)?.name ?? ''
    const trips = data.trips.slice().reverse().filter((item) => item.orderId === order.id)
    const trip = trips.find((item) => ['Assigned', 'In Progress'].includes(item.status)) ?? trips[0]
    const staffUser = (id?: string) => data.users.find((item) => item.id === id && item.accountStatus !== 'Pending') ?? null
    return [{ order, company, tripId: trip?.id, tripStatus: trip?.status, assignmentContext: trip ? {
      driver: staffUser(data.drivers.find((item) => item.id === trip.assignment.driverId)?.userId),
      mechanic: staffUser(data.mechanics.find((item) => item.id === trip.assignment.mechanicId)?.userId),
      vehicleRegistration: data.vehicles.find((item) => item.id === trip.assignment.vehicleId)?.registration,
      actualStartAt: trip.actualStartAt,
    } : undefined, conversations: matches.map((conversation) => {
      const peerId = user.id === conversationOwnerId(conversation) ? conversation.participantId : conversationOwnerId(conversation)
      const peer = data.users.find((item) => item.id === peerId)!
      const messages = data.chatMessages.filter((item) => item.conversationId === conversation.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      return { ...conversation, peer, messages, unread: messages.filter((item) => item.recipientId === user.id && !item.readBy.includes(user.id)).length }
    }) }]
  })
  return structuredClone({ user, rooms })
}
