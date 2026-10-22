import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Search, MoreVertical } from 'lucide-react'
import { Menu } from '@base-ui/react/menu'
import { applicationServices } from '../../services/application-services'
import { userRoles } from '../../types/domain'
import { adminRoleLabels, filterAdminUsers } from '../../types/admin'
import type { AdminWorkspace } from '../../types/admin'
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/page-states'
import { useCoordinatorQuery } from '../coordinator/use-coordinator-query'
import { AdminAvatar, AdminPagination, AdminStatus } from './admin-components'
import { UserProfile } from './user-profile'
import { downloadAdminCsv } from './admin-export'
import './admin.css'

export function AdminUsersPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getAdminWorkspace)
  if (!result) return <div className="coord-page"><LoadingState label="Loading user accounts…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <AdminUsers data={result.data} />
}
export function AdminUsers({ data }: { data: AdminWorkspace }) {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'all'; const search = params.get('q') ?? ''
  const [role, setRole] = useState('all'); const [status, setStatus] = useState('all'); const [page, setPage] = useState(0)
  const { userId } = useParams(); const navigate = useNavigate()
  const drivers = tab === 'drivers'; const companies = tab === 'companies'
  const filtered = filterAdminUsers(data.users, search, drivers ? 'driver' : role, status)
  const companyRows = data.companies.filter((company) => `${company.name} ${company.businessRegistrationNumber ?? ''} ${data.users.filter((item) => item.company?.id === company.id).map((item) => `${item.user.name} ${item.user.email}`).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase()))
  const total = companies ? companyRows.length : filtered.length
  const currentPage = Math.min(page, Math.max(0, Math.ceil(total / 8) - 1))
  const selected = data.users.find((item) => item.user.id === userId)
  const update = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next); setPage(0) }
  const exportRows = () => downloadAdminCsv(companies ? [['Company', 'Business registration', 'Contacts'], ...companyRows.map((company) => [company.name, company.businessRegistrationNumber ?? '', data.users.filter((item) => item.company?.id === company.id).map((item) => `${item.user.name} <${item.user.email}>`).join('; ')])] : [['User', 'Email', 'Role', 'Status'], ...filtered.map(({ user }) => [user.name, user.email, adminRoleLabels[user.role], user.accountStatus ?? 'Active'])], `fleetsync-${companies ? 'companies' : 'users'}-${data.capturedAt.slice(0, 10)}.csv`)
  return <div className="coord-page"><div className="coord-page-heading"><div><h1>User accounts</h1><p>Everyone who can sign in — staff, drivers and customers. Only administrators can manage accounts.</p></div><div className="coord-actions"><button className="coord-button secondary" onClick={exportRows}>Export CSV</button><button className="coord-button" disabled title="Direct provisioning is not yet defined. Approve staff applications to create accounts.">+ Create user</button></div></div>
    <nav className="coord-tabs" aria-label="User account sections">{[{ key: 'all', label: 'All users', count: data.users.length }, { key: 'drivers', label: 'Drivers', count: data.users.filter((item) => item.user.role === 'driver').length }, { key: 'companies', label: 'Customer companies', count: data.companies.length }].map((item) => <button key={item.key} className={tab === item.key ? 'active' : ''} aria-current={tab === item.key ? 'page' : undefined} onClick={() => { update('tab', item.key); setRole('all'); setStatus('all') }}>{item.label}<span>{item.count}</span></button>)}<button disabled title="The Figma permission matrix requires reconciliation with current service contracts before permission management is enabled">Roles &amp; permissions<span>{userRoles.length}</span></button></nav>
    <section className="coord-card"><div className="admin-filters"><label><Search size={16} aria-hidden="true" /><input aria-label={companies ? 'Search companies or contacts' : 'Search by name or email'} placeholder={companies ? 'Search company, BR no. or contact' : 'Search by name or email'} value={search} onChange={(event) => update('q', event.target.value)} /></label>{!companies && <><select className="coord-input" aria-label="User role" disabled={drivers} value={drivers ? 'driver' : role} onChange={(event) => { setRole(event.target.value); setPage(0) }}><option value="all">All roles</option>{userRoles.map((value) => <option key={value} value={value}>{adminRoleLabels[value]}</option>)}</select><select className="coord-input" aria-label="Account status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0) }}><option value="all">All statuses</option><option>Active</option><option>Pending</option></select></>}<span>Showing {total ? currentPage * 8 + 1 : 0}–{Math.min(total, (currentPage + 1) * 8)} of {total}</span></div>
    {companies ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr>{['Company', 'Customer contacts', 'Billing address', 'Actions'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{companyRows.slice(currentPage * 8, currentPage * 8 + 8).map((company) => <tr key={company.id}><td>{company.name}<small>{company.businessRegistrationNumber ?? 'Registration not recorded'}</small></td><td>{data.users.filter((item) => item.company?.id === company.id).map(({ user }) => <div key={user.id}><Link className="coord-link" to={`/admin/users/${user.id}?tab=companies`}>{user.name}</Link><small>{user.email}</small></div>)}</td><td>{company.billingAddress ?? 'Not recorded'}</td><td><Link className="coord-link" to="/admin/applications?type=Customer">Applications</Link></td></tr>)}</tbody></table></div> : <div className="admin-table-scroll"><table className="admin-table"><thead><tr>{[drivers ? 'Driver' : 'User', drivers ? 'Licence class' : 'Role', 'Status', drivers ? 'Resource availability' : 'Last sign-in', 'Actions'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{filtered.slice(currentPage * 8, currentPage * 8 + 8).map(({ user, driver }) => <tr key={user.id}><td><div className="admin-person"><AdminAvatar name={user.name} /><div>{user.name}<small>{user.email}</small></div></div></td><td>{drivers ? driver?.licence ?? 'Not recorded' : adminRoleLabels[user.role]}</td><td><AdminStatus status={user.accountStatus ?? 'Active'} /></td><td>{drivers ? driver?.available ? 'Available' : 'Reserved or unavailable' : 'Not recorded'}</td><td><div className="coord-actions justify-end"><Link className="coord-button secondary small" to={`/admin/users/${user.id}${params.size ? `?${params}` : ''}`}>View profile</Link><Menu.Root><Menu.Trigger className="coord-button secondary small" aria-label={`Actions for ${user.name}`}><MoreVertical size={16} /></Menu.Trigger><Menu.Portal><Menu.Positioner sideOffset={6} align="end" className="z-50"><Menu.Popup className="coordinator-shell rounded-lg border bg-white p-2 shadow-lg"><Menu.Item className="rounded px-3 py-2 text-sm" onClick={() => navigate(`/admin/users/${user.id}`)}>View profile / Change role</Menu.Item><Menu.Item disabled className="rounded px-3 py-2 text-sm opacity-50" title="Deactivation policy is not approved">Deactivate account</Menu.Item></Menu.Popup></Menu.Positioner></Menu.Portal></Menu.Root></div></td></tr>)}</tbody></table></div>}
    {!total && <EmptyState title="No accounts found" description="Try another search or filter." />}<AdminPagination page={currentPage} total={total} onChange={setPage} /></section>
    {userId && (selected ? <UserProfile key={userId} data={selected} onClose={() => navigate(`/admin/users${params.size ? `?${params}` : ''}`)} /> : <ErrorState message="This user account is unavailable." />)}
  </div>
}
