import { Menu } from '@base-ui/react/menu'
import { ChevronDown, Menu as MenuIcon, Search } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useEffect, useState } from 'react'
import { NotificationMenu } from './notification-menu'
import { Button } from '../ui/button'
import { applicationServices } from '../../services/application-services'
import { roleLabels } from '../../routes/navigation'
import { type User, type WebRole } from '../../types/domain'

export function Header({ user, expanded, onToggle }: { user: User & { role: WebRole }; expanded: boolean; onToggle: () => void }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [company, setCompany] = useState<{ userId: string; name: string } | null>(null)
  useEffect(() => {
    let current = true
    if (user.role === 'customer') void applicationServices.getCustomerWorkspace().then((result) => { if (current && result.ok) setCompany({ userId: user.id, name: result.data.company.name }) }).catch(() => {})
    return () => { current = false }
  }, [user.id, user.role])
  const logout = async () => {
    setBusy(true)
    await applicationServices.logout()
    navigate('/login', { replace: true })
    setBusy(false)
  }
  const itemClass = 'cursor-default rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-muted data-disabled:opacity-50'
  return <header className="flex min-h-16 flex-wrap items-center gap-3 border-b bg-background px-4 py-3 sm:px-6">
    <Button variant="ghost" size="icon" className="md:hidden" aria-label="Toggle navigation" aria-expanded={expanded} aria-controls="app-navigation" onClick={onToggle}><MenuIcon /></Button>
    {user.role === 'coordinator' || user.role === 'customer' || user.role === 'admin' ? <><form className="coord-header-search" role="search" onSubmit={(event) => { event.preventDefault(); navigate(`${user.role === 'customer' ? '/customer/orders' : user.role === 'admin' ? '/admin/users' : '/coordinator/orders'}${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`) }}><Search size={16} aria-hidden="true" /><input aria-label={user.role === 'customer' ? 'Search your orders' : user.role === 'admin' ? 'Search user accounts' : 'Search operational orders'} placeholder={user.role === 'customer' ? 'Search your orders…' : 'Search orders, trips, vehicles…'} value={search} onChange={(event) => setSearch(event.target.value)} /></form></> : <span className="mr-auto text-xs font-medium text-muted-foreground">FleetSync</span>}
    <div className="ml-auto"><NotificationMenu key={user.id} /></div>
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
