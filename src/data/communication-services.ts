import { z } from 'zod'
import type { DemoStore } from '../store/demo-store.ts'
import type { ChatMessage } from '../types/domain.ts'
import { composeMailSchema, sendChatSchema, conversationOwnerId } from '../types/communications.ts'
import type { ChatWorkspace, ComposeMailInput, ConversationView, Mailbox, MailFlag, MailMessage, SendChatInput } from '../types/communications.ts'
import type { ServiceResult } from '../services/contracts.ts'
import type { MessageNotificationService } from '../services/message-notifications.ts'
import { localMessageNotifications } from './message-notifications.ts'
import { chatWorkspace, orderConversations } from './communication-projections.ts'

const fail = (error: string) => ({ ok: false as const, error })
const draftSchema = composeMailSchema.extend({ recipientIds: z.array(z.string().min(1)).refine((ids) => new Set(ids).size === ids.length, 'Remove duplicate recipients.'), subject: z.string().trim().max(200), body: z.string().trim().max(20000) })

export function createCommunicationServices(store: DemoStore, delayMs: number, notifier: MessageNotificationService = localMessageNotifications) {
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  const actor = () => store.getState().data.users.find((item) => item.id === store.getState().sessionUserId && item.accountStatus !== 'Pending')
  const canMail = () => { const user = actor(); return user && ['admin', 'coordinator'].includes(user.role) ? user : undefined }
  const visibleMail = (mail: MailMessage, userId: string) => mail.senderId === userId || (mail.status !== 'Draft' && mail.recipientIds.includes(userId))
  const findConversation = (id: string, userId: string) => orderConversations(store.getState().data).find((item) => item.id === id && [conversationOwnerId(item), item.participantId].includes(userId))
  return {
    async getChatWorkspace(): Promise<ServiceResult<ChatWorkspace>> {
      await wait(); const user = actor()
      return user && ['coordinator', 'customer', 'driver', 'mechanic'].includes(user.role) ? { ok: true, data: chatWorkspace(store.getState().data, user) } : fail('You do not have access to order conversations.')
    },
    async getConversation(id: string): Promise<ServiceResult<ConversationView>> {
      await wait(); const user = actor()
      if (!user || !findConversation(id, user.id)) return fail('This conversation is unavailable to your account.')
      const result = chatWorkspace(store.getState().data, user).rooms.flatMap((room) => room.conversations).find((item) => item.id === id)
      return result ? { ok: true, data: result } : fail('Conversation not found.')
    },
    async sendChatMessage(input: SendChatInput): Promise<ServiceResult<ChatMessage>> {
      const sessionUserId = store.getState().sessionUserId
      await wait(); const user = actor(); const parsed = sendChatSchema.safeParse(input)
      if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the message.')
      if (user?.id !== sessionUserId) return fail('Your account changed before the message was saved. Please sign in again.')
      const conversation = user && findConversation(parsed.data.conversationId, user.id)
      if (!user || !conversation) return fail('This conversation is unavailable to your account.')
      const { data } = store.getState()
      const previous = data.chatMessages.find((item) => item.id === parsed.data.messageId)
      if (previous) return previous.senderId === user.id && previous.conversationId === conversation.id && previous.text === parsed.data.text ? { ok: true, data: structuredClone(previous) } : fail('Message identifier is already in use.')
      const message: ChatMessage = { id: parsed.data.messageId ?? `message-${crypto.randomUUID()}`, conversationId: conversation.id, orderId: conversation.orderId, senderId: user.id, recipientId: user.id === conversationOwnerId(conversation) ? conversation.participantId : conversationOwnerId(conversation), text: parsed.data.text, createdAt: new Date().toISOString(), readBy: [user.id], deliveryState: 'Stored locally', simulated: true }
      try {
        const notifications = notifier.prepare([message.recipientId], `New message from ${user.name} · ${conversation.orderId}`, message.createdAt)
        store.setState({ data: { ...data, conversations: data.conversations.some((item) => item.id === conversation.id) ? data.conversations : [...data.conversations, conversation], chatMessages: [...data.chatMessages, message], notifications: [...data.notifications, ...notifications] } })
        return { ok: true, data: structuredClone(message) }
      } catch { return fail('Unable to store the message. Please try again.') }
    },
    async markConversationRead(id: string): Promise<ServiceResult<null>> {
      const sessionUserId = store.getState().sessionUserId
      await wait(); const user = actor()
      if (!user || user.id !== sessionUserId || !findConversation(id, user.id)) return fail('This conversation is unavailable to your account.')
      const { data } = store.getState()
      if (data.chatMessages.some((item) => item.conversationId === id && item.recipientId === user.id && !item.readBy.includes(user.id))) {
        store.setState({ data: { ...data, chatMessages: data.chatMessages.map((item) => item.conversationId === id && item.recipientId === user.id && !item.readBy.includes(user.id) ? { ...item, readBy: [...item.readBy, user.id] } : item) } })
      }
      return { ok: true, data: null }
    },
    async getMailbox(): Promise<ServiceResult<Mailbox>> {
      await wait(); const user = canMail()
      if (!user) return fail('Internal mail is available to Administrators and Coordinators.')
      const { data } = store.getState()
      return { ok: true, data: structuredClone({ user, users: data.users.filter((item) => ['admin', 'coordinator'].includes(item.role) && item.accountStatus !== 'Pending'), messages: data.mailMessages.filter((item) => visibleMail(item, user.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }) }
    },
    async saveMail(input: ComposeMailInput, draft: boolean): Promise<ServiceResult<MailMessage>> {
      await wait(); const user = canMail(); const parsed = (draft ? draftSchema : composeMailSchema).safeParse(input)
      if (!user) return fail('Internal mail is available to Administrators and Coordinators.')
      if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the message fields.')
      const values = parsed.data; const { data } = store.getState()
      if (values.recipientIds.some((id) => id === user.id || !data.users.some((item) => item.id === id && item.accountStatus !== 'Pending' && ['admin', 'coordinator'].includes(item.role)))) return fail('Choose an active Administrator or Coordinator other than yourself.')
      const previous = data.mailMessages.find((item) => item.id === values.id)
      if (previous && previous.senderId !== user.id) return fail('This message cannot be changed by your account.')
      if (previous && previous.status !== 'Draft') return !draft && previous.subject === values.subject && previous.body === values.body && JSON.stringify(previous.recipientIds) === JSON.stringify(values.recipientIds) ? { ok: true, data: structuredClone(previous) } : fail('Stored messages cannot be edited.')
      if ([values.replyToId, values.forwardedFromId].some((id) => id && !data.mailMessages.some((item) => item.id === id && item.status !== 'Draft' && visibleMail(item, user.id)))) return fail('The referenced message is unavailable.')
      const message: MailMessage = { id: values.id ?? `mail-${crypto.randomUUID()}`, senderId: user.id, recipientIds: values.recipientIds, subject: values.subject, body: values.body, createdAt: new Date().toISOString(), status: draft ? 'Draft' : 'Stored locally', readBy: [user.id], starredBy: previous?.starredBy ?? [], trashedBy: [], replyToId: values.replyToId, forwardedFromId: values.forwardedFromId }
      try {
        const notifications = draft ? [] : notifier.prepare(message.recipientIds, `Internal mail from ${user.name} · ${message.subject}`, message.createdAt)
        store.setState({ data: { ...data, mailMessages: [...data.mailMessages.filter((item) => item.id !== message.id), message], notifications: [...data.notifications, ...notifications] } })
        return { ok: true, data: structuredClone(message) }
      } catch { return fail('Unable to store the message. Please try again.') }
    },
    async setMailFlag(id: string, flag: MailFlag, enabled: boolean): Promise<ServiceResult<null>> {
      await wait(); const user = canMail(); const { data } = store.getState()
      const message = data.mailMessages.find((item) => item.id === id)
      if (!user || !message || !visibleMail(message, user.id)) return fail('This message is unavailable to your account.')
      if (!['read', 'starred', 'trash'].includes(flag)) return fail('Unknown mail action.')
      const key = flag === 'read' ? 'readBy' : flag === 'starred' ? 'starredBy' : 'trashedBy'
      if (message[key].includes(user.id) !== enabled) store.setState({ data: { ...data, mailMessages: data.mailMessages.map((item) => item.id === id ? { ...item, [key]: enabled ? [...item[key], user.id] : item[key].filter((id) => id !== user.id) } : item) } })
      return { ok: true, data: null }
    },
  }
}
