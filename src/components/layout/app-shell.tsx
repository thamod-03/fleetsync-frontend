import { useState } from 'react'
import { Outlet } from 'react-router'
import { useDemoUser, useStorageNotice } from '../../hooks/use-demo'
import { webRoles, type WebRole } from '../../types/domain'
import { Header } from './header'
import { Sidebar } from './sidebar'

export function AppShell() {
  const user = useDemoUser()
  const notice = useStorageNotice()
  const [expanded, setExpanded] = useState(false)
  if (!user || !webRoles.some((role) => role === user.role)) return null
  const role = user.role as WebRole
  return <div className="min-h-svh md:flex">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-background focus:p-3">Skip to content</a>
    <Sidebar role={role} expanded={expanded} />
    <div className="min-w-0 flex-1 bg-muted/30">
      <Header user={{ ...user, role }} expanded={expanded} onToggle={() => setExpanded((value) => !value)} />
      <main id="main-content" tabIndex={-1}>
        {notice && <p role="status" className="m-4 rounded-lg border bg-card p-4 text-sm">{notice}</p>}
        <Outlet />
      </main>
    </div>
  </div>
}
