import { Fragment, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { Send } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { applicationServices } from '../../services/application-services'
import { ErrorState } from '../ui/page-states'
import { sendChatSchema, type ChatWorkspace, type SendChatInput } from '../../types/communications'
import { initials, messageTime } from '../../features/coordinator/message-format'

export function ConversationPane({ conversation, userId, tripId, customerOrderId }: { conversation: ChatWorkspace['rooms'][number]['conversations'][number]; userId: string; tripId?: string; customerOrderId?: string }) {
  const [error, setError] = useState('')
  const historyEnd = useRef<HTMLDivElement>(null)
  const pending = useRef<{ text: string; id: string } | null>(null)
  const latestId = conversation.messages.at(-1)?.id
  useEffect(() => { historyEnd.current?.scrollIntoView({ block: 'nearest' }) }, [latestId])
  const form = useForm<SendChatInput>({ resolver: zodResolver(sendChatSchema), defaultValues: { conversationId: conversation.id, text: '' } })
  useEffect(() => {
    let current = true
    if (conversation.unread) void applicationServices.markConversationRead(conversation.id).then((result) => { if (!result.ok && current) setError(result.error) }).catch(() => { if (current) setError('Unable to update unread messages.') })
    return () => { current = false }
  }, [conversation.id, conversation.unread])
  const submit = (event: FormEvent<HTMLFormElement>) => form.handleSubmit(async (input) => {
    setError('')
    if (!pending.current || pending.current.text !== input.text) pending.current = { text: input.text, id: `message-${crypto.randomUUID()}` }
    try { const result = await applicationServices.sendChatMessage({ ...input, messageId: pending.current.id }); if (result.ok) { pending.current = null; form.reset({ conversationId: conversation.id, text: '' }) } else setError(result.error) }
    catch { setError('Unable to store the message. Please try again.') }
  })(event)
  const field = <textarea rows={1} className="coord-input" aria-label={`Write a message to ${conversation.peer.name}`} placeholder={`Write a message to ${conversation.peer.name.split(' ')[0]}…`} maxLength={4000} {...form.register('text')} aria-invalid={!!form.formState.errors.text} aria-describedby={form.formState.errors.text ? 'chat-message-error' : undefined} disabled={form.formState.isSubmitting} />
  return <section className="chat-conversation"><div className="chat-conversation-header"><span className="workspace-avatar">{initials(conversation.peer.name)}</span><div><h2>{conversation.peer.name}</h2><small>{customerOrderId ? `${conversation.peer.role === 'coordinator' ? 'Operational Coordinator' : conversation.peer.role === 'driver' ? 'Driver' : 'Mechanic'} · ${customerOrderId}` : conversation.peer.role}</small></div>{customerOrderId ? <Link className="coord-button secondary small" to={`/customer/orders/${customerOrderId}`}>View order</Link> : tripId && <Link className="coord-button secondary small" to={`/coordinator/trips/${tripId}`}>View trip</Link>}</div>
    {error && <ErrorState message={error} />}
    <div className="chat-history" role="log" aria-label={`Conversation with ${conversation.peer.name}`} aria-live="polite">{conversation.messages.length ? conversation.messages.map((message, index) => {
      const date = new Date(message.createdAt).toDateString()
      const previous = conversation.messages[index - 1]
      return <Fragment key={message.id}>{customerOrderId && (!previous || new Date(previous.createdAt).toDateString() !== date) && <div className="customer-chat-day">{date === new Date().toDateString() ? 'Today' : new Date(message.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}<div className={`chat-message ${message.senderId === userId ? 'outgoing' : ''}`}><small className={customerOrderId ? 'sr-only' : undefined}>{message.senderId === userId ? 'You' : conversation.peer.name}</small><p>{message.text}</p><time dateTime={message.createdAt}>{customerOrderId ? new Date(message.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : messageTime(message.createdAt)}{message.senderId === userId ? ' · Stored locally' : ''}</time></div></Fragment>
    }) : <p className="workspace-muted">No messages yet. Start the conversation.</p>}<div ref={historyEnd} aria-hidden="true" /></div>
    <form className="chat-composer" onSubmit={submit} noValidate><div>{customerOrderId ? <div className="customer-chat-input">{field}</div> : field}{form.formState.errors.text && <p className="coord-field-error" id="chat-message-error" role="alert">{form.formState.errors.text.message}</p>}</div><button className="coord-button" disabled={form.formState.isSubmitting}>{!customerOrderId && <Send size={14} aria-hidden="true" />}{form.formState.isSubmitting ? 'Saving…' : 'Send'}</button></form>
  </section>
}
