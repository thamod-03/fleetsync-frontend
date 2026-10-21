import { Menu } from '@base-ui/react/menu'
import { Bell, ChevronDown, Menu as MenuIcon, Search } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { applicationServices } from '../../services/application-services'
import { roleLabels } from '../../routes/navigation'
import { type User, type WebRole } from '../../types/domain'

export function Header({ user, expanded, onToggle }: { user: User & { role: WebRole }; expanded: boolean; onToggle: () => void }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationText, setNotificationText] = useState('Loading notifications…')
  const [company, setCompany] = useState<{ userId: string; name: string } | null>(null)
  useEffect(() => {
    let current = true
    if (user.role === 'customer') void applicationServices.getCustomerWorkspace().then((result) => { if (current && result.ok) setCompany({ userId: user.id, name: result.data.company.name }) }).catch(() => {})
    return () => { current = false }
  }, [user.id, user.role])
  const notifications = async () => {
    setShowNotifications((value) => !value)
    try {
      const result = await (user.role === 'customer' ? applicationServices.getCustomerWorkspace() : applicationServices.getCoordinatorOverview())
      setNotificationText(result.ok ? result.data.notifications.map((item) => item.message).join('\n') || 'No notifications.' : result.error)
    } catch {
      setNotificationText('Unable to load notifications. Please try again.')
    }
  }
  const logout = async () => {
    setBusy(true)
    await applicationServices.logout()
    navigate('/login', { replace: true })
    setBusy(false)
  }
  const itemClass = 'cursor-default rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-muted data-disabled:opacity-50'
  return <header className="flex min-h-16 flex-wrap items-center gap-3 border-b bg-background px-4 py-3 sm:px-6">
    <Button variant="ghost" size="icon" className="md:hidden" aria-label="Toggle navigation" aria-expanded={expanded} aria-controls="app-navigation" onClick={onToggle}><MenuIcon /></Button>
    {user.role === 'coordinator' || user.role === 'customer' ? <><form className="coord-header-search" role="search" onSubmit={(event) => { event.preventDefault(); navigate(`${user.role === 'customer' ? '/customer/orders' : '/coordinator/orders'}${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`) }}><Search size={16} aria-hidden="true" /><input aria-label={user.role === 'customer' ? 'Search your orders' : 'Search operational orders'} placeholder={user.role === 'customer' ? 'Search your orders…' : 'Search orders, trips, vehicles…'} value={search} onChange={(event) => setSearch(event.target.value)} /></form><div className="relative ml-auto"><Button variant="ghost" size="icon" aria-label="Notifications" aria-expanded={showNotifications} onClick={() => void notifications()}><Bell size={18} /></Button>{showNotifications && <div role="status" className="absolute right-0 z-20 mt-2 w-72 whitespace-pre-line rounded-lg border bg-white p-4 text-sm shadow-lg">{notificationText}</div>}</div></> : <span className="mr-auto text-xs font-medium text-muted-foreground">FleetSync</span>}
    <Menu.Root>
      <Menu.Trigger render={<Button variant="ghost" disabled={busy} className="h-auto max-w-full gap-3 py-1" />}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs" aria-hidden="true">{user.name.split(' ').map((part) => part[0]).join('')}</span>
        <span className="min-w-0 text-left"><span className="block truncate text-sm">{user.name}</span><span className="block text-xs font-normal text-muted-foreground">{roleLabels[user.role]}{user.role === 'customer' && company?.userId === user.id ? ` · ${company.name}` : ''}</span></span>
        <ChevronDown aria-hidden="true" className="size-4" />
      </Menu.Trigger>
      <Menu.Portal><Menu.Positioner sideOffset={8} align="end" className="z-50"><Menu.Popup className="w-64 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
        <Menu.Item className={itemClass} disabled={busy} onClick={() => void logout()}>Sign out</Menu.Item>
      </Menu.Popup></Menu.Positioner></Menu.Portal>
    </Menu.Root>
  </header>
}
