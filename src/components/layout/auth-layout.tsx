import { Link, Outlet, useLocation } from 'react-router'
import { useStorageNotice } from '../../hooks/use-demo'
import logo from '../../assets/auth/logo.svg'
import brandCheck from '../../assets/auth/brand-check.svg'
import '../../features/auth/auth.css'

export function AuthLayout() {
  const notice = useStorageNotice()
  const { pathname } = useLocation()
  return <div className="auth-shell">
    <aside className="auth-brand" aria-label="About FleetSync">
      <Link to="/login" className="auth-logo"><span className="auth-logo-mark"><img src={logo} width="64" height="64" alt="" /></span><span>Fleet<span className="auth-logo-sync">Sync</span></span></Link>
      <div className="auth-pitch"><h2>Every vehicle, trip and service — in one place.</h2>
        <p>Plan trips, assign drivers, track maintenance and see fleet performance without spreadsheets or phone calls.</p>
        <ul>{['Real-time vehicle and driver availability', 'Preventive service alerts from odometer readings', pathname === '/login' ? 'Role-based dashboards for every user' : 'Role-based dashboards for every team member'].map((text) => <li key={text}><img src={brandCheck} alt="" />{text}</li>)}</ul>
      </div>
    </aside>
    <main id="main-content" className="auth-panel">
      {notice && <p role="status" className="rounded-lg border bg-card p-4 text-sm">{notice}</p>}
      <Outlet />
    </main>
  </div>
}
