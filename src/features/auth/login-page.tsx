import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/ui/button'
import { ErrorState } from '../../components/ui/page-states'
import { mockServices } from '../../data/mock-services'
import { roleLabels } from '../../routes/navigation'
import { getLoginDestination } from '../../routes/access'
import { webRoles, type WebRole } from '../../types/domain'

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState<WebRole | null>(null)
  const [error, setError] = useState<string | null>(null)
  const signIn = async (role: WebRole) => {
    setBusy(role)
    setError(null)
    const result = await mockServices.signIn(role)
    if (result.ok) {
      navigate(getLoginDestination(role, params.get('from')), { replace: true })
    } else setError(result.error)
    setBusy(null)
  }
  return <section className="space-y-5 rounded-xl border bg-card p-6 sm:p-8">
    <div><p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Frontend foundation</p><h1 className="text-2xl font-semibold">Welcome to FleetSync</h1></div>
    <p className="text-sm leading-6 text-muted-foreground">Choose a fictional persona to explore the shared workspace. Demo-only authentication and route guards provide no production security.</p>
    {error && <ErrorState message={error} />}
    <div className="grid gap-3">{webRoles.map((role) => <Button className="h-11 justify-start" variant="outline" disabled={busy !== null} key={role} onClick={() => void signIn(role)}>{busy === role ? 'Opening workspace…' : `Continue as ${roleLabels[role]}`}</Button>)}</div>
    <nav aria-label="Authentication" className="flex flex-wrap gap-4 text-sm underline underline-offset-4"><Link to="/register">Customer registration</Link><Link to="/forgot-password">Forgot password</Link><Link to="/apply/staff">Staff application</Link></nav>
  </section>
}
