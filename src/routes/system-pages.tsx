import { Link, Navigate, useRouteError } from 'react-router'
import { EmptyState, ErrorState } from '../components/ui/page-states'
import { useDemoUser } from '../hooks/use-demo'
import { roleHome } from './navigation'
import { webRoles, type WebRole } from '../types/domain'

export function HomeRedirect() {
  const user = useDemoUser()
  return <Navigate replace to={user && webRoles.some((role) => role === user.role) ? roleHome[user.role as WebRole] : '/login'} />
}
export function SystemPage({ kind }: { kind: 'not-found' | 'unauthorized' }) {
  const user = useDemoUser()
  const home = user && webRoles.some((role) => role === user.role) ? roleHome[user.role as WebRole] : '/login'
  return <div className="mx-auto max-w-xl p-6 sm:py-20"><EmptyState title={kind === 'not-found' ? 'Page not found' : 'Access denied'} description={kind === 'not-found' ? 'This address does not match an implemented page.' : 'Your current demo persona cannot access this workspace. Switch personas from your dashboard account menu.'} action={<Link className="text-sm underline underline-offset-4" to={home}>Return to {user ? 'your dashboard' : 'demo login'}</Link>} /></div>
}
export function RouteErrorPage() {
  useRouteError()
  return <div className="mx-auto max-w-xl space-y-4 p-6"><ErrorState message="The workspace could not be displayed. Reload the page to try again." /><a className="text-sm underline" href="/">Reload FleetSync</a></div>
}
