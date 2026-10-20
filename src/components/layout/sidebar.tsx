import { NavLink } from 'react-router'
import { navigation, roleLabels } from '../../routes/navigation'
import type { NavigationItem } from '../../routes/navigation'
import type { WebRole } from '../../types/domain'

export function Sidebar({ role, items = navigation[role], expanded }: { role: WebRole; items?: NavigationItem[]; expanded: boolean }) {
  return <aside id="app-navigation" className={`${expanded ? 'block' : 'hidden'} border-b bg-sidebar p-3 md:sticky md:top-0 md:block md:h-svh md:w-[248px] md:shrink-0 md:border-r md:border-b-0`}>
    <div className="px-2 py-4"><p className="font-semibold">FleetSync</p><p className="mt-1 text-xs text-muted-foreground">{roleLabels[role]}</p></div>
    <nav aria-label="Primary navigation" className="space-y-1">
      {items.map(({ label, to, icon: Icon }) => <NavLink end key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground' : 'hover:bg-muted'}`}>
        <Icon aria-hidden="true" className="size-[18px]" />{label}
      </NavLink>)}
    </nav>
    <p className="mt-6 px-3 text-xs leading-5 text-muted-foreground">Additional navigation will appear as feature screens are implemented.</p>
  </aside>
}
