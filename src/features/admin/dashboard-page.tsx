import { adminDate } from './admin-format'
import { Link } from 'react-router'
import { UserPlus, Truck, Building2, SlidersHorizontal } from 'lucide-react'
import { applicationServices } from '../../services/application-services'
import { useCoordinatorQuery } from '../coordinator/use-coordinator-query'
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/page-states'
import { AdminCard, AdminStatus } from './admin-components'
import { adminRoleLabels } from '../../types/admin'
import type { AdminWorkspace } from '../../types/admin'
import { userRoles } from '../../types/domain'
import usersIcon from '../../assets/admin/users.svg'
import applicationsIcon from '../../assets/admin/applications.svg'
import changesIcon from '../../assets/admin/changes.svg'
import auditIcon from '../../assets/admin/audit.svg'
import './admin.css'

export function AdminDashboardPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getAdminWorkspace)
  if (!result) return <div className="coord-page"><LoadingState label="Loading administrator dashboard…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <AdminDashboard data={result.data} />
}
export function AdminDashboard({ data }: { data: AdminWorkspace }) {
  const active = data.users.filter(({ user }) => user.accountStatus !== 'Pending')
  const pending = data.applications.filter((item) => item.status === 'Pending')
  const today = data.activity.filter((item) => item.createdAt.slice(0, 10) === data.capturedAt.slice(0, 10))
  const cards = [
    { label: 'Active users', value: active.length, note: `${userRoles.length} roles`, icon: usersIcon, tone: 'neutral' },
    { label: 'Pending applications', value: pending.length, note: `${pending.filter((item) => item.kind === 'Staff').length} staff · ${pending.filter((item) => item.kind === 'Customer').length} customers`, icon: applicationsIcon, tone: 'pending' },
    { label: 'Profile change requests', value: '—', note: 'Not recorded', icon: changesIcon, tone: 'info' },
    { label: 'Audit events today', value: today.length, note: today[0] ? `Last event ${adminDate(today[0].createdAt)}` : 'No events today', icon: auditIcon, tone: 'accent' },
  ]
  return <div className="coord-page"><div className="coord-page-heading"><div><h1>Good {new Date(data.capturedAt).getHours() < 12 ? 'morning' : new Date(data.capturedAt).getHours() < 18 ? 'afternoon' : 'evening'}, {data.actor.name.split(' ')[0]}</h1><p>{pending.length} account applications are waiting for your review.</p></div><div className="coord-actions"><button className="coord-button secondary" disabled title="Standalone audit export is outside this batch">Export audit log</button><button className="coord-button" disabled title="Direct account creation requires an approved provisioning policy. Review staff applications instead."><UserPlus size={16} />Create user</button></div></div>
    <div className="coord-kpis">{cards.map((item) => <section className="coord-kpi" key={item.label}><span className={`coord-icon coord-badge-${item.tone}`}><img src={item.icon} alt="" /></span><div><h2>{item.label}</h2><strong>{item.value}</strong><p>{item.note}</p></div></section>)}</div>
    <div className="admin-grid"><div className="admin-stack"><AdminCard title="Account applications" subtitle="Review, approve or reject requests for new accounts" action={<Link className="coord-link" to="/admin/applications">View all</Link>}>
      {pending.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr>{['Applicant', 'Type', 'Requested role', 'Submitted', 'Status'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{pending.slice(0, 4).map((item) => <tr key={item.id}><td><Link className="coord-link" to={`/admin/applications/${item.id}`}>{item.name}</Link><small>{item.email}</small></td><td>{item.kind}</td><td>{adminRoleLabels[item.role]}</td><td>{adminDate(item.createdAt)}</td><td><AdminStatus status={item.status} /></td></tr>)}</tbody></table></div> : <EmptyState title="No pending applications" description="New account requests will appear here." />}
    </AdminCard><AdminCard title="Quick actions"><div className="admin-quick-actions"><Link to="/admin/applications"><UserPlus size={20} /><div>Review staff applications<small>Approve requests and create accounts</small></div></Link><button disabled title="Vehicle Management is outside this batch"><Truck size={20} /><div>Add vehicle<small>Register plate, type and odometer</small></div></button><Link to="/admin/users?tab=companies"><Building2 size={20} /><div>Customer companies<small>View companies and linked contacts</small></div></Link><button disabled title="Reference Data is outside this batch"><SlidersHorizontal size={20} /><div>Manage service types<small>Intervals used for alerts</small></div></button></div></AdminCard></div>
      <div className="admin-stack"><AdminCard title="Users by role" subtitle={`${active.length} active accounts`}>{userRoles.map((role) => { const count = active.filter(({ user }) => user.role === role).length; return <div className="admin-role-row" key={role}><div><span>{adminRoleLabels[role]}</span><span>{count}</span></div><progress aria-label={`${adminRoleLabels[role]} active accounts`} value={count} max={Math.max(1, active.length)} /></div> })}</AdminCard><AdminCard title="Profile change requests"><p className="coord-card-body">Profile change requests are not available yet.</p></AdminCard></div>
    </div>
    <AdminCard title="Recent audit activity" subtitle="Recorded activity from shared application services" action={<button className="coord-link" disabled title="The standalone Audit Log screen is outside this batch">Open audit log</button>}><div className="admin-table-scroll"><table className="admin-table"><thead><tr>{['Time', 'User', 'Action', 'Record'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{data.activity.slice(0, 5).map((item) => <tr key={item.id}><td>{adminDate(item.createdAt)}</td><td>{item.actorName}</td><td>{item.action.replace(/^Demo /, '')}</td><td className="coord-mono">{item.entityId}</td></tr>)}</tbody></table></div>{!data.activity.length && <p className="coord-card-body">No recorded activity.</p>}</AdminCard>
  </div>
}
