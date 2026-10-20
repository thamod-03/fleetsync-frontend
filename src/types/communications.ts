import { z } from 'zod'
import type { ChatMessage, TransportOrder, User } from './domain.ts'

const id = z.string().min(1)
export const conversationSchema = z.object({ id, orderId: id, coordinatorId: id, participantId: id })
export const mailMessageSchema = z.object({
  id, senderId: id, recipientIds: z.array(id), subject: z.string().max(200), body: z.string().max(20000),
  createdAt: z.iso.datetime(), status: z.enum(['Draft', 'Stored locally']),
  readBy: z.array(id).default([]), starredBy: z.array(id).default([]), trashedBy: z.array(id).default([]),
  replyToId: id.optional(), forwardedFromId: id.optional(),
})
export const sendChatSchema = z.object({ conversationId: id, messageId: id.optional(), text: z.string().trim().min(1, 'Write a message.').max(4000, 'Use at most 4,000 characters.') })
export const composeMailSchema = z.object({
  id: id.optional(), recipientIds: z.array(id).min(1, 'Choose a recipient.').refine((ids) => new Set(ids).size === ids.length, 'Remove duplicate recipients.'),
  subject: z.string().trim().min(1, 'Enter a subject.').max(200), body: z.string().trim().min(1, 'Write a message.').max(20000),
  replyToId: id.optional(), forwardedFromId: id.optional(),
})
export type Conversation = z.infer<typeof conversationSchema>
export type MailMessage = z.infer<typeof mailMessageSchema>
export type ComposeMailInput = z.infer<typeof composeMailSchema>
export type SendChatInput = z.infer<typeof sendChatSchema>
export interface ConversationView extends Conversation { peer: User; messages: ChatMessage[]; unread: number }
export interface OrderRoom { order: TransportOrder; company: string; tripId?: string; tripStatus?: string; conversations: ConversationView[] }
export interface ChatWorkspace { user: User; rooms: OrderRoom[] }
export interface Mailbox { user: User; users: User[]; messages: MailMessage[] }
export type MailFlag = 'read' | 'starred' | 'trash'
