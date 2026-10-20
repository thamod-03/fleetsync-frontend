import { Menu } from '@base-ui/react/menu'
import { ChevronDown, Menu as MenuIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useState } from 'react'
import { Button } from '../ui/button'
import { mockServices } from '../../data/mock-services'
import { roleHome, roleLabels } from '../../routes/navigation'
import { webRoles, type User, type WebRole } from '../../types/domain'

export function Header({ user, expanded, onToggle }: { user: User & { role: WebRole }; expanded: boolean; onToggle: () => void }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const switchPersona = async (role: WebRole) => {
    setBusy(true)
    setError(null)
    const result = await mockServices.signIn(role)
    if (result.ok) navigate(roleHome[result.data.role as WebRole])
    else setError(result.error)
    setBusy(false)
  }
  const logout = async () => {
    setBusy(true)
    await mockServices.logout()
    navigate('/login', { replace: true })
    setBusy(false)
  }
  const itemClass = 'cursor-default rounded-md px-3 py-2 text-sm outline-none data-highlighted:bg-muted data-disabled:opacity-50'
  return <header className="flex min-h-16 flex-wrap items-center gap-3 border-b bg-background px-4 py-3 sm:px-6">
    <Button variant="ghost" size="icon" className="md:hidden" aria-label="Toggle navigation" aria-expanded={expanded} aria-controls="app-navigation" onClick={onToggle}><MenuIcon /></Button>
    <span className="mr-auto text-xs font-medium text-muted-foreground">Demo workspace</span>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Menu.Root>
      <Menu.Trigger render={<Button variant="ghost" disabled={busy} className="h-auto max-w-full gap-3 py-1" />}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs" aria-hidden="true">{user.name.split(' ').map((part) => part[0]).join('')}</span>
        <span className="min-w-0 text-left"><span className="block truncate text-sm">{user.name}</span><span className="block text-xs font-normal text-muted-foreground">{roleLabels[user.role]}</span></span>
        <ChevronDown aria-hidden="true" className="size-4" />
      </Menu.Trigger>
      <Menu.Portal><Menu.Positioner sideOffset={8} align="end" className="z-50"><Menu.Popup className="w-64 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg">
        <Menu.Group><Menu.GroupLabel className="px-3 py-2 text-xs text-muted-foreground">Switch demo persona</Menu.GroupLabel>
          {webRoles.map((role) => <Menu.Item className={itemClass} key={role} disabled={busy || role === user.role} onClick={() => void switchPersona(role)}>{roleLabels[role]}{role === user.role ? ' (current)' : ''}</Menu.Item>)}
        </Menu.Group>
        <Menu.Separator className="my-1 h-px bg-border" />
        <Menu.Item className={itemClass} disabled={busy} onClick={() => void logout()}>Log out of demo</Menu.Item>
      </Menu.Popup></Menu.Positioner></Menu.Portal>
    </Menu.Root>
  </header>
}
