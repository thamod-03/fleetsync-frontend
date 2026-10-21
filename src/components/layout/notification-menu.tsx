import { Popover } from '@base-ui/react/popover'
import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { useApplicationRevision } from '../../hooks/use-demo'
import { applicationServices } from '../../services/application-services'
import type { Notification } from '../../types/domain'

export function NotificationMenu() {
  const revision = useApplicationRevision()
  const [items, setItems] = useState<Notification[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let current = true
    void applicationServices.getNotifications().then((result) => {
      if (!current) return
      if (result.ok) { setItems(result.data); setError('') }
      else setError(result.error)
    }).catch(() => { if (current) setError('Unable to load notifications. Please try again.') })
    return () => { current = false }
  }, [revision, attempt])
  const unread = items?.filter((item) => !item.read).length ?? 0
  const markAll = async () => {
    setBusy(true)
    try {
      const result = await applicationServices.markAllNotificationsRead()
      if (!result.ok) setError(result.error)
      else setAttempt((value) => value + 1)
    } catch { setError('Unable to update notifications. Please try again.') }
    finally { setBusy(false) }
  }
  return <Popover.Root>
    <Popover.Trigger render={<Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} />}>
      <Bell size={18} aria-hidden="true" />
      {unread > 0 && <span aria-hidden="true" className="absolute right-0 top-0 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-4 text-white">{unread > 99 ? '99+' : unread}</span>}
    </Popover.Trigger>
    <Popover.Portal><Popover.Positioner align="end" sideOffset={8} className="z-50"><Popover.Popup className="w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <Popover.Title className="text-sm font-semibold">Notifications{unread > 0 ? ` (${unread})` : ''}</Popover.Title>
        <button className="rounded px-1 py-1 text-xs font-medium text-indigo-600 focus-visible:outline-2 disabled:opacity-50" disabled={!unread || busy} onClick={() => void markAll()}>{busy ? 'Updating…' : 'Mark all as read'}</button>
      </div>
      {error && <div role="alert" className="border-b px-4 py-3 text-sm text-red-700">{error} <button className="underline" onClick={() => setAttempt((value) => value + 1)}>Retry</button></div>}
      {!items && !error ? <p role="status" className="p-4 text-sm text-muted-foreground">Loading notifications…</p> : items && <NotificationList items={items} />}
    </Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root>
}

export function NotificationList({ items }: { items: Notification[] }) {
  if (!items.length) return <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
  return <ul aria-label="Your notifications" className="max-h-[min(420px,60vh)] divide-y overflow-y-auto">
    {items.map((item) => <li key={item.id} className={`flex items-start gap-3 px-4 py-3 ${item.read ? '' : 'bg-indigo-50/60'}`}>
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read ? 'bg-transparent' : 'bg-indigo-600'}`} aria-hidden="true" />
      <div className="min-w-0 flex-1"><span className="sr-only">{item.read ? 'Read: ' : 'Unread: '}</span><p className="text-sm leading-5 [overflow-wrap:anywhere]">{item.message}</p><time dateTime={item.createdAt} className="mt-1 block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time></div>
    </li>)}
  </ul>
}
