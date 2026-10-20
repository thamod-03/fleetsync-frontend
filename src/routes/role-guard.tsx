import { Navigate, Outlet, useLocation } from 'react-router'
import { useDemoUser } from '../hooks/use-demo'
import type { WebRole } from '../types/domain'
import { getAccessRedirect } from './access'

export function RoleGuard({ role }: { role: WebRole }) {
  const user = useDemoUser()
  const location = useLocation()
  const redirect = getAccessRedirect(user, role, location.pathname + location.search)
  if (redirect) return <Navigate replace to={redirect} />
  return <Outlet />
}
