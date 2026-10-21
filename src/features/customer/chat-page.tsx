import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { applicationServices } from '../../services/application-services'
import type { ChatWorkspace, OrderRoom } from '../../types/communications'
import { ErrorState, EmptyState, LoadingState } from '../../components/ui/page-states'
import { ConversationPane } from '../../components/chat/conversation-pane'
import { useCoordinatorQuery } from '../coordinator/use-coordinator-query'
import { initials, messageTime } from '../coordinator/message-format'
import { CustomerStatus } from './customer-components'
import { customerDate } from './customer-format'
import searchIcon from '../../assets/customer-chat/search.svg'
import infoIcon from '../../assets/customer-chat/info.svg'
import '../coordinator/workspace.css'
import './customer.css'
import './chat.css'

function roomStatus(room: OrderRoom) {
  return room.tripStatus === 'In Progress' ? 'Trip in progress' : room.tripStatus ?? (room.order.status === 'Submitted' ? 'Pending review' : room.order.status)
}
export function CustomerChatPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getChatWorkspace)
  if (!result) return <div className="coord-page"><LoadingState label="Loading conversations…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /><Link className="coord-link" to="/customer/orders">Back to my orders</Link></div>
  return <CustomerChat data={result.data} />
}
export function CustomerChat({ data }: { data: ChatWorkspace }) {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const conversationId = params.get('conversationId')
  const requestedOrder = params.get('orderId')
  const room = data.rooms.find((item) => requestedOrder !== null ? item.order.id === requestedOrder : conversationId !== null ? item.conversations.some((conversation) => conversation.id === conversationId) : false) ?? (requestedOrder === null && conversationId === null ? data.rooms[0] : undefined)
  const conversation = room?.conversations.find((item) => item.id === conversationId) ?? (conversationId === null ? room?.conversations[0] : undefined)
  const filtered = data.rooms.filter((item) => `${item.order.id} ${item.order.origin} ${item.order.destination} ${item.tripId ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))
  const unavailableSelection = (requestedOrder !== null || conversationId !== null) && (!room || !conversation)
  return <div className="coord-page customer-chat"><div className="coord-page-heading"><div><h1>Chat</h1><p>Each of your orders has its own chat room. Pick an order, then the person you want to talk to.</p></div></div>
    {unavailableSelection && <ErrorState message="This conversation is unavailable to your account. Choose one of your order rooms." />}
    {!data.rooms.length && !unavailableSelection ? <EmptyState title="No conversations yet" description="Order conversations become available when you have a submitted order and an available coordinator." action={<Link className="coord-button" to="/customer/orders">My orders</Link>} /> : <div className="chat-workspace">
      <aside className="workspace-list" aria-label="Your order rooms"><div className="workspace-list-heading"><strong>Order rooms</strong><small>{data.rooms.length} {data.rooms.length === 1 ? 'order' : 'orders'}</small></div><label className="workspace-search"><img src={searchIcon} alt="" /><input aria-label="Search order number" placeholder="Search order number" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        {filtered.map((item) => {
          const messages = item.conversations.flatMap((entry) => entry.messages).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          const latest = messages.at(-1)
          const peer = item.conversations.find((entry) => entry.messages.some((message) => message.id === latest?.id))?.peer
          const unread = item.conversations.reduce((sum, entry) => sum + entry.unread, 0)
          return <button className={`workspace-list-item ${room?.order.id === item.order.id ? 'selected' : ''}`} key={item.order.id} aria-pressed={room?.order.id === item.order.id} onClick={() => setParams({ orderId: item.order.id })}>
            <div><span className="coord-mono">{item.order.id}</span><small>· {item.tripId ?? 'No trip yet'}</small>{latest && <time dateTime={latest.createdAt}>{messageTime(latest.createdAt)}</time>}</div><div><strong>{item.order.origin} → {item.order.destination}</strong><CustomerStatus>{roomStatus(item)}</CustomerStatus></div><p>{latest ? `${latest.senderId === data.user.id ? 'You' : peer?.name.split(' ')[0] ?? 'Coordinator'}: ${latest.text}` : 'No messages yet.'}</p>{unread > 0 && <span className="workspace-unread" aria-label={`${unread} unread messages`}>{unread}</span>}
          </button>
        })}
        {!filtered.length && <p className="workspace-muted">No matching order rooms.</p>}
      </aside>
      <aside className="chat-people" aria-label="People on this order">{room ? <><div className="chat-order-heading"><span className="coord-mono">{room.order.id} · {room.tripId ?? 'No trip yet'}</span><strong>{room.order.origin} → {room.order.destination}</strong><small>{roomStatus(room)}{room.assignmentContext?.actualStartAt ? ` · started ${customerDate(room.assignmentContext.actualStartAt)}` : ''}</small></div><h2>PEOPLE ON THIS ORDER</h2>
        {room.conversations.map((item) => <button key={item.id} className={`chat-person ${conversation?.id === item.id ? 'selected' : ''}`} aria-pressed={conversation?.id === item.id} onClick={() => setParams({ orderId: room.order.id, conversationId: item.id })}><span className="workspace-avatar">{initials(item.peer.name)}</span><span><strong>{item.peer.name}</strong><small>{item.peer.role === 'coordinator' ? 'Coordinator' : item.peer.role === 'driver' ? `Driver${room.assignmentContext?.vehicleRegistration ? ` - ${room.assignmentContext.vehicleRegistration}` : ''}` : 'Mechanic'}</small></span>{item.unread > 0 && <span className="workspace-unread" aria-label={`${item.unread} unread messages`}>{item.unread}</span>}</button>)}
        <p className="chat-people-note"><img src={infoIcon} alt="" />{room.tripId ? 'Messages are private to you and the selected person.' : 'The driver and mechanic appear here once a trip is assigned for your order.'}</p>
      </> : <p className="workspace-muted">Select an order.</p>}</aside>
      {room && conversation ? <ConversationPane key={`${data.user.id}:${conversation.id}`} conversation={conversation} userId={data.user.id} customerOrderId={room.order.id} /> : <EmptyState title="Select a conversation" description="Choose one of your orders and a coordinator to view messages." />}
    </div>}
  </div>
}
