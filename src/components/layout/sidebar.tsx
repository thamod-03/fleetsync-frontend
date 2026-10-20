import { NavLink, useLocation } from 'react-router'
import { navigation, roleLabels } from '../../routes/navigation'
import type { NavigationItem } from '../../routes/navigation'
import type { WebRole } from '../../types/domain'
import { BarChart3, LogOut, Mail, MessageCircle, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useState } from 'react'
import { applicationServices } from '../../services/application-services'
import logo from '../../assets/auth/logo.svg'

export function Sidebar({ role, items = navigation[role], expanded }: { role: WebRole; items?: NavigationItem[]; expanded: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const logout = async () => { setBusy(true); await applicationServices.logout(); navigate('/login', { replace: true }); setBusy(false) }
  return <aside id="app-navigation" className={`${expanded ? 'block' : 'hidden'} border-b bg-sidebar p-3 md:sticky md:top-0 md:block md:h-svh md:w-[248px] md:shrink-0 md:border-r md:border-b-0`}>
    {role === 'coordinator' ? <><div className="coord-brand"><span className="coord-logo"><img src={logo} alt="" /></span><div><strong>Fleet<span>Sync</span></strong><p>Coordinator</p></div></div><p className="coord-menu-label">MENU</p></> : <div className="px-2 py-4"><p className="font-semibold">FleetSync</p><p className="mt-1 text-xs text-muted-foreground">{roleLabels[role]}</p></div>}
    <nav aria-label="Primary navigation" className="space-y-1">
      {items.map(({ label, to, icon: Icon }) => <NavLink end={to === '/coordinator' || role !== 'coordinator'} key={to} to={to} className={({ isActive }) => role === 'coordinator' ? `coord-nav-item ${isActive || (to === '/coordinator/trips' && location.pathname.startsWith('/coordinator/trips/')) ? 'active' : ''}` : `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : 'hover:bg-muted'}`}>
        <Icon aria-hidden="true" className="size-[18px]" />{label}
      </NavLink>)}
      {role === 'coordinator' && [{ label: 'Chat', icon: MessageCircle }, { label: 'Mail', icon: Mail }, { label: 'Reports', icon: BarChart3 }].map(({ label, icon: Icon }) => <button key={label} className="coord-nav-item" disabled title="Currently unavailable"><Icon aria-hidden="true" />{label}</button>)}
    </nav>
    {role === 'coordinator' ? <div className="coord-nav-footer"><button className="coord-nav-item" disabled title="Currently unavailable"><UserRound aria-hidden="true" />Profile</button><button className="coord-nav-item" onClick={() => void logout()} disabled={busy}><LogOut aria-hidden="true" />Logout</button></div> : <p className="mt-6 px-3 text-xs leading-5 text-muted-foreground">Additional navigation will appear as feature screens are implemented.</p>}
  </aside>
}
