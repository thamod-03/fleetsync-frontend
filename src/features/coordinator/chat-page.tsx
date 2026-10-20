import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Info, Search, Send } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { applicationServices } from '../../services/application-services'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/page-states'
import { sendChatSchema, type ChatWorkspace, type SendChatInput } from '../../types/communications'
import { StatusBadge } from './coordinator-components'
import { useCoordinatorQuery } from './use-coordinator-query'
import './workspace.css'
import { initials, messageTime } from './message-format'

export function ChatPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getChatWorkspace)
  if (!result) return <div className="coord-page"><LoadingState label="Loading conversations…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <ChatWorkspaceView data={result.data} />
}

export function ChatWorkspaceView({ data }: { data: ChatWorkspace }) {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const room = data.rooms.find((item) => item.order.id === params.get('orderId')) ?? (!params.has('orderId') ? data.rooms[0] : undefined)
  const conversation = room?.conversations.find((item) => item.id === params.get('conversationId')) ?? (!params.has('conversationId') ? room?.conversations[0] : undefined)
  const filtered = data.rooms.filter((item) => `${item.order.id} ${item.company} ${item.tripId ?? ''}`.toLowerCase().includes(search.toLowerCase()))
  return <div className="coord-page"><div className="coord-page-heading"><div><h1>Chat</h1><p>Every order has its own chat room. Pick an order, then the person you want to talk to.</p></div></div>
    <div className="chat-workspace"><aside className="workspace-list"><div className="workspace-list-heading"><strong>Order rooms</strong><small>{data.rooms.length} rooms</small></div><label className="workspace-search"><Search size={14} aria-hidden="true" /><input aria-label="Search order, customer or trip" placeholder="Search order, customer or trip" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      {filtered.map((item) => { const messages = item.conversations.flatMap((entry) => entry.messages).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); const latest = messages[0]; const unread = item.conversations.reduce((sum, entry) => sum + entry.unread, 0); return <button className={`workspace-list-item ${room?.order.id === item.order.id ? 'selected' : ''}`} key={item.order.id} aria-pressed={room?.order.id === item.order.id} onClick={() => setParams({ orderId: item.order.id })}><div><span className="coord-mono">{item.order.id}</span><small>{item.tripId ?? 'No trip yet'}</small></div><div><strong>{item.company}</strong><StatusBadge>{item.tripStatus ?? 'Pending review'}</StatusBadge></div><p>{latest ? `${latest.senderId === data.user.id ? 'You' : item.conversations.find((entry) => entry.messages.some((message) => message.id === latest.id))?.peer.name.split(' ')[0]}: ${latest.text}` : 'No messages yet.'}</p>{unread > 0 && <span className="workspace-unread" aria-label={`${unread} unread messages`}>{unread}</span>}</button> })}
      {!filtered.length && <p className="workspace-muted">No matching order rooms.</p>}
    </aside>
      <aside className="chat-people">{room ? <><div className="chat-order-heading"><span className="coord-mono">{room.order.id} · {room.tripId ?? 'No trip yet'}</span><strong>{room.company}</strong><small>{room.order.origin} → {room.order.destination}</small></div><h2>PEOPLE ON THIS ORDER</h2>{room.conversations.map((item) => <button key={item.id} className={`chat-person ${conversation?.id === item.id ? 'selected' : ''}`} aria-pressed={conversation?.id === item.id} onClick={() => setParams({ orderId: room.order.id, conversationId: item.id })}><span className="workspace-avatar">{initials(item.peer.name)}</span><span><strong>{item.peer.name}</strong><small>{item.peer.role === 'customer' ? `Customer · ${room.company}` : item.peer.role[0].toUpperCase() + item.peer.role.slice(1)}</small></span>{item.unread > 0 && <span className="workspace-unread">{item.unread}</span>}</button>)}<p className="chat-people-note"><Info size={14} aria-hidden="true" />The driver and mechanic join the room when a trip is created for the order.</p></> : <p className="workspace-muted">Select an order.</p>}</aside>
      {conversation ? <ConversationPane key={conversation.id} conversation={conversation} userId={data.user.id} tripId={room?.tripId} /> : <EmptyState title="Select a conversation" description="Choose an order and person to view messages." />}
    </div>
  </div>
}

function ConversationPane({ conversation, userId, tripId }: { conversation: ChatWorkspace['rooms'][number]['conversations'][number]; userId: string; tripId?: string }) {
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
  return <section className="chat-conversation"><div className="chat-conversation-header"><span className="workspace-avatar">{initials(conversation.peer.name)}</span><div><h2>{conversation.peer.name}</h2><small>{conversation.peer.role}</small></div>{tripId && <Link className="coord-button secondary small" to={`/coordinator/trips/${tripId}`}>View trip</Link>}</div>
    {error && <ErrorState message={error} />}
    <div className="chat-history" role="log" aria-label={`Conversation with ${conversation.peer.name}`} aria-live="polite">{conversation.messages.length ? conversation.messages.map((message) => <div key={message.id} className={`chat-message ${message.senderId === userId ? 'outgoing' : ''}`}><small>{message.senderId === userId ? 'You' : conversation.peer.name}</small><p>{message.text}</p><time dateTime={message.createdAt}>{messageTime(message.createdAt)}{message.senderId === userId ? ' · Stored locally' : ''}</time></div>) : <p className="workspace-muted">No messages yet. Start the conversation.</p>}<div ref={historyEnd} aria-hidden="true" /></div>
    <form className="chat-composer" onSubmit={submit} noValidate><div><textarea rows={1} className="coord-input" aria-label={`Write a message to ${conversation.peer.name}`} placeholder={`Write a message to ${conversation.peer.name.split(' ')[0]}…`} maxLength={4000} {...form.register('text')} aria-invalid={!!form.formState.errors.text} aria-describedby="chat-message-error" disabled={form.formState.isSubmitting} />{form.formState.errors.text && <p className="coord-field-error" id="chat-message-error">{form.formState.errors.text.message}</p>}</div><button className="coord-button" disabled={form.formState.isSubmitting}><Send size={14} aria-hidden="true" />{form.formState.isSubmitting ? 'Saving…' : 'Send'}</button></form>
  </section>
}
