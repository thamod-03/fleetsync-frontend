import { useEffect, useState } from 'react'
import { ArrowUpRight, CornerUpLeft, CornerUpLeftIcon, Inbox, Mail, Search, Star, Trash2, FileText } from 'lucide-react'
import { applicationServices } from '../../services/application-services'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/page-states'
import type { ComposeMailInput, Mailbox, MailFlag, MailMessage } from '../../types/communications'
import { useCoordinatorQuery } from './use-coordinator-query'
import { initials, messageTime } from './message-format'
import { MailComposeDialog } from './mail-compose-dialog'
import './workspace.css'

const folders = [{ label: 'Inbox', icon: Inbox }, { label: 'Starred', icon: Star }, { label: 'Sent', icon: ArrowUpRight }, { label: 'Drafts', icon: FileText }, { label: 'Trash', icon: Trash2 }] as const
type Folder = typeof folders[number]['label']

export function MailPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getMailbox)
  if (!result) return <div className="coord-page"><LoadingState label="Loading internal mail…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <MailWorkspace data={result.data} />
}

export function MailWorkspace({ data }: { data: Mailbox }) {
  const [folder, setFolder] = useState<Folder>('Inbox')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [compose, setCompose] = useState<ComposeMailInput | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const userId = data.user.id
  const userName = (id: string) => data.users.find((user) => user.id === id)?.name ?? id
  const unread = data.messages.filter((message) => message.status !== 'Draft' && message.recipientIds.includes(userId) && !message.trashedBy.includes(userId) && !message.readBy.includes(userId)).length
  const drafts = data.messages.filter((message) => message.senderId === userId && message.status === 'Draft' && !message.trashedBy.includes(userId)).length
  const messages = data.messages.filter((message) => {
    const trashed = message.trashedBy.includes(userId)
    if (folder === 'Trash' ? !trashed : trashed) return false
    const matches = folder === 'Inbox' ? message.recipientIds.includes(userId) && message.status !== 'Draft' : folder === 'Sent' ? message.senderId === userId && message.status !== 'Draft' : folder === 'Drafts' ? message.status === 'Draft' && message.senderId === userId : folder === 'Starred' ? message.starredBy.includes(userId) : true
    return matches && `${message.subject} ${message.body} ${userName(message.senderId)}`.toLowerCase().includes(search.toLowerCase())
  })
  const selected = messages.find((message) => message.id === selectedId) ?? (selectedId === null ? messages[0] : undefined)
  const selectedUnread = !!selected && selected.status !== 'Draft' && selected.recipientIds.includes(userId) && !selected.readBy.includes(userId)
  const selectedMessageId = selected?.id
  useEffect(() => {
    let current = true
    if (selectedMessageId && selectedUnread) void applicationServices.setMailFlag(selectedMessageId, 'read', true).then((result) => { if (!result.ok && current) setError(result.error) }).catch(() => { if (current) setError('Unable to mark this message as read.') })
    return () => { current = false }
  }, [selectedMessageId, selectedUnread]) // A local open marks only the signed-in user's copy.
  const setFlag = async (message: MailMessage, flag: MailFlag, enabled: boolean) => {
    setBusy(true); setError('')
    try { const result = await applicationServices.setMailFlag(message.id, flag, enabled); if (!result.ok) setError(result.error); else if (flag === 'trash' || (flag === 'read' && !enabled)) setSelectedId('') }
    catch { setError('Unable to update the message. Please try again.') }
    finally { setBusy(false) }
  }
  const composeFrom = (message?: MailMessage, action?: 'reply' | 'all' | 'forward') => {
    setNotice('')
    if (message?.status === 'Draft') { setCompose({ ...message }); return }
    const recipients = !message || action === 'forward' ? [] : [...new Set([message.senderId, ...(action === 'all' || message.senderId === userId ? message.recipientIds : [])])].filter((id) => id !== userId)
    setCompose({ id: `mail-${crypto.randomUUID()}`, recipientIds: recipients, subject: message ? `${action === 'forward' ? 'Fwd:' : 'Re:'} ${message.subject.replace(/^(Re:|Fwd:)\s*/i, '')}` : '', body: message ? `\n\n--- ${userName(message.senderId)} · ${messageTime(message.createdAt)} ---\n${message.body}` : '', replyToId: message && action !== 'forward' ? message.id : undefined, forwardedFromId: action === 'forward' ? message?.id : undefined })
  }
  return <div className="coord-page"><div className="coord-page-heading"><div><h1>Mail</h1><p>Email with the Fleet Administrator and other coordinators.</p></div><button className="coord-button" onClick={() => composeFrom()}>Compose</button></div>
    {error && <ErrorState message={error} />}{notice && <p role="status" className="coord-confirmation">{notice}</p>}
    <div className="mail-workspace"><nav className="mail-folders" aria-label="Mail folders">{folders.map(({ label, icon: Icon }) => <button key={label} className={folder === label ? 'selected' : ''} aria-current={folder === label ? 'page' : undefined} onClick={() => { setFolder(label); setSelectedId(null) }}><Icon size={16} aria-hidden="true" /><span>{label}</span>{label === 'Inbox' && unread > 0 ? unread : label === 'Drafts' && drafts > 0 ? drafts : ''}</button>)}</nav>
      <aside className="workspace-list"><label className="workspace-search"><Search size={14} aria-hidden="true" /><input aria-label="Search mail" placeholder="Search mail" value={search} onChange={(event) => { setSearch(event.target.value); setSelectedId(null) }} /></label><div className="workspace-list-heading"><strong>{folder}</strong><small>{unread} unread</small></div>{messages.map((message) => <button key={message.id} className={`workspace-list-item mail-list-item ${selected?.id === message.id ? 'selected' : ''} ${!message.readBy.includes(userId) ? 'unread' : ''}`} aria-pressed={selected?.id === message.id} onClick={() => setSelectedId(message.id)}><span className="workspace-avatar">{initials(userName(message.senderId))}</span><span><span className="mail-list-sender">{userName(message.senderId)}<small>{messageTime(message.createdAt)}</small></span><strong>{message.subject || '(No subject)'}</strong><span className="mail-snippet">{message.body || 'Empty draft'}</span></span></button>)}{!messages.length && <p className="workspace-muted">No matching messages.</p>}</aside>
      {selected ? <section className="mail-reading"><div className="mail-toolbar">{selected.status === 'Draft' ? <button className="coord-button secondary small" onClick={() => composeFrom(selected)}>Edit draft</button> : <><button className="coord-button secondary small" onClick={() => composeFrom(selected, 'reply')}><CornerUpLeft size={14} aria-hidden="true" />Reply</button><button className="coord-button secondary small" onClick={() => composeFrom(selected, 'all')}><CornerUpLeftIcon size={14} aria-hidden="true" />Reply all</button><button className="coord-button secondary small" onClick={() => composeFrom(selected, 'forward')}><ArrowUpRight size={14} aria-hidden="true" />Forward</button></>}<button className="mail-icon-button" disabled={busy} aria-label={selected.starredBy.includes(userId) ? 'Remove star' : 'Star message'} aria-pressed={selected.starredBy.includes(userId)} onClick={() => void setFlag(selected, 'starred', !selected.starredBy.includes(userId))}><Star size={16} fill={selected.starredBy.includes(userId) ? '#fbbf24' : 'none'} /></button><button className="mail-icon-button" disabled={busy} aria-label={folder === 'Trash' ? 'Restore message' : 'Move message to trash'} onClick={() => void setFlag(selected, 'trash', folder !== 'Trash')}><Trash2 size={16} /></button></div>
        <article><h2>{selected.subject || '(No subject)'}</h2><div className="mail-sender"><span className="workspace-avatar">{initials(userName(selected.senderId))}</span><div><strong>{userName(selected.senderId)}</strong><small>{data.users.find((user) => user.id === selected.senderId)?.email}</small><small>To: {selected.recipientIds.map(userName).join(', ') || 'No recipients'}</small></div><time dateTime={selected.createdAt}>{messageTime(selected.createdAt)}</time></div><p className="mail-delivery">{selected.status === 'Draft' ? 'Draft' : 'Stored in internal mail · No external email delivery'}</p><div className="mail-body">{selected.body}</div>{selected.recipientIds.includes(userId) && selected.status !== 'Draft' && <button className="coord-link" disabled={busy} onClick={() => void setFlag(selected, 'read', false)}><Mail size={14} className="inline" aria-hidden="true" /> Mark unread</button>}</article>
      </section> : <EmptyState title="Select a message" description="Choose a message to read, reply or forward." />}
    </div>
    {compose && <MailComposeDialog initial={compose} users={data.users.filter((user) => user.id !== userId)} onClose={() => setCompose(null)} onSaved={(draft) => { setCompose(null); setNotice(draft ? 'Draft saved.' : 'Message stored in internal mail. No external email was sent.'); setFolder(draft ? 'Drafts' : 'Sent'); setSelectedId(compose.id ?? null) }} />}
  </div>
}
