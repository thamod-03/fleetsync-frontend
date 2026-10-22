import { adminDate } from './admin-format'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Search } from 'lucide-react'
import { applicationServices } from '../../services/application-services'
import { useCoordinatorQuery } from '../coordinator/use-coordinator-query'
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/page-states'
import { AdminAvatar, AdminStatus, AdminPagination } from './admin-components'
import { adminRoleLabels } from '../../types/admin'
import type { AdminWorkspace } from '../../types/admin'
import { staffRoles } from '../../types/domain'
import { downloadAdminCsv } from './admin-export'
import './admin.css'

export function AdminApplicationsPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getAdminWorkspace)
  if (!result) return <div className="coord-page"><LoadingState label="Loading account applications…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <AdminApplications data={result.data} />
}
export function AdminApplications({ data }: { data: AdminWorkspace }) {
  const [params] = useSearchParams()
  const [status, setStatus] = useState('Pending'); const [kind, setKind] = useState(params.get('type') ?? 'all')
  const [role, setRole] = useState('all'); const [search, setSearch] = useState(''); const [page, setPage] = useState(0)
  const filtered = data.applications.filter((item) => (status === 'all' || item.status === status) && (kind === 'all' || item.kind === kind) && (role === 'all' || item.role === role) && `${item.name} ${item.id} ${item.email}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 8) - 1))
  return <div className="coord-page"><div className="coord-page-heading"><div><h1>Applications</h1><p>Requests for new staff and customer accounts. Review each request before making a decision.</p></div><button className="coord-button secondary" onClick={() => downloadAdminCsv([['Application', 'Applicant', 'Type', 'Role', 'Submitted', 'Status'], ...filtered.map((item) => [item.id, item.name, item.kind, adminRoleLabels[item.role], item.createdAt, item.status])], `fleetsync-applications-${data.capturedAt.slice(0, 10)}.csv`)}>Export CSV</button></div>
    <ol className="admin-steps">{[['Submitted', 'Applicant fills the application form'], ['Review', 'Check details and document metadata'], ['Decision', 'Approve or reject'], ['Provision', 'Account created after approval']].map(([label, note], index) => <li key={label}><b>{index + 1}</b><div>{label}<small>{note}</small></div></li>)}</ol>
    <nav className="coord-tabs" aria-label="Application status filters">{[['Pending', 'Open'], ['Approved', 'Approved'], ['Rejected', 'Rejected'], ['all', 'All']].map(([value, label]) => <button key={value} className={value === status ? 'active' : ''} aria-current={value === status ? 'page' : undefined} onClick={() => { setStatus(value); setPage(0) }}>{label}<span>{data.applications.filter((item) => value === 'all' || item.status === value).length}</span></button>)}</nav>
    <section className="coord-card"><div className="admin-filters"><label><Search size={16} aria-hidden="true" /><input aria-label="Search applicant or application ID" placeholder="Search applicant or application ID" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} /></label><select className="coord-input" aria-label="Application type" value={kind} onChange={(event) => { setKind(event.target.value); setPage(0) }}><option value="all">All types</option><option>Staff</option><option>Customer</option></select><select className="coord-input" aria-label="Requested role" value={role} onChange={(event) => { setRole(event.target.value); setPage(0) }}><option value="all">All roles</option>{[...staffRoles, 'customer' as const].map((value) => <option value={value} key={value}>{adminRoleLabels[value]}</option>)}</select><span>{filtered.length} applications</span></div>
    <div className="admin-table-scroll"><table className="admin-table"><thead><tr>{['Applicant', 'Type', 'Requested role', 'Submitted', 'Documents', 'Status', 'Actions'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{filtered.slice(currentPage * 8, currentPage * 8 + 8).map((item) => <tr key={item.id}><td><div className="admin-person"><AdminAvatar name={item.name} /><div>{item.name}<small className="coord-mono">{item.id}</small>{item.company && <small>{item.company.name}</small>}</div></div></td><td>{item.kind}</td><td>{adminRoleLabels[item.role]}</td><td>{adminDate(item.createdAt)}</td><td>{item.staff ? `${item.staff.documents.length} metadata records` : 'Not required by current form'}</td><td><AdminStatus status={item.status} /></td><td><Link className={`coord-button ${item.status !== 'Pending' ? 'secondary' : ''} small`} to={`/admin/applications/${item.id}`}>{item.status === 'Pending' ? 'Review' : 'View'}</Link></td></tr>)}</tbody></table></div>
    {!filtered.length && <EmptyState title="No applications found" description="New account applications appear here after submission." />}<AdminPagination page={currentPage} total={filtered.length} onChange={setPage} /></section>
  </div>
}
