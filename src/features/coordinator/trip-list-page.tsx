import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Activity, AlertTriangle, Check, Search, Truck, Users } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/page-states'
import { applicationServices } from '../../services/application-services'
import { tripStatuses, type TripStatus } from '../../types/domain'
import type { TripList } from '../../types/trip-management'
import { CoordinatorCard, StatusBadge } from './coordinator-components'
import { formatDate } from './coordinator-format'
import { filterTrips, tripAttention } from './trip-list-helpers'
import { useCoordinatorQuery } from './use-coordinator-query'

export function TripListPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getTrips)
  if (!result) return <div className="coord-page"><LoadingState label="Loading trips…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <Trips data={result.data} />
}
export function Trips({ data }: { data: TripList }) {
  const [params] = useSearchParams()
  const [status, setStatus] = useState<TripStatus>(() => tripStatuses.find((value) => value === params.get('status')) ?? (data.items.some((item) => item.trip.status === 'In Progress') ? 'In Progress' : data.items[0]?.trip.status ?? 'Assigned'))
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('time')
  const [page, setPage] = useState(0)
  const items = filterTrips(data.items, { status, search, sort })
  const pages = Math.max(1, Math.ceil(items.length / 8))
  const currentPage = Math.min(page, pages - 1)
  const today = new Date(data.capturedAt).toLocaleDateString('en-CA')
  const todayUpdates = data.items.flatMap((item) => {
    const timestamp = item.trip.status === 'Completed' ? item.trip.actualReturnDate : item.trip.actualStartAt
    return timestamp && new Date(timestamp).toLocaleDateString('en-CA') === today ? [{ item, timestamp }] : []
  }).sort((a,b) => b.timestamp.localeCompare(a.timestamp))
  const attention = tripAttention(data.items, data.capturedAt)
  const stats = [
    { label: 'In progress', value: data.items.filter((item) => item.trip.status === 'In Progress').length, meta: 'Started trips', icon: Activity, tone: 'info' },
    { label: 'Assigned', value: data.items.filter((item) => item.trip.status === 'Assigned').length, meta: 'Waiting for the driver to start', icon: Users, tone: 'success' },
    { label: 'Not started on time', value: data.items.filter((item) => item.trip.status === 'Assigned' && item.trip.scheduledStart && item.trip.scheduledStart < data.capturedAt).length, meta: 'Past its scheduled start', icon: AlertTriangle, tone: 'danger' },
    { label: 'Completed today', value: data.items.filter((item) => item.trip.status === 'Completed' && new Date(item.trip.actualReturnDate).toLocaleDateString('en-CA') === today).length, meta: 'Return and odometer recorded', icon: Truck, tone: 'neutral' },
  ]
  return <div className="coord-page">
    <div className="coord-page-heading"><div><h1>Trips</h1><p>Every trip and its status, from draft to completed. Drivers update the status from the Driver app when they start and complete a trip.</p></div><Link className="coord-button" to="/coordinator/trips/create">Create trip</Link></div>
    <div className="coord-kpis">{stats.map(({ label, value, meta, icon: Icon, tone }) => <section className="coord-kpi" key={label}><span className={`coord-icon coord-badge-${tone}`}><Icon size={20} aria-hidden="true" /></span><div><h2>{label}</h2><strong>{value}</strong><p>{meta}</p></div></section>)}</div>
    <div className="coord-trip-updates-grid">
      <CoordinatorCard title="Driver updates" subtitle="Recorded trip updates today">{todayUpdates.length ? todayUpdates.slice(0, 6).map(({ item, timestamp }) => <div className="coord-trip-update" key={item.trip.id}><time>{new Date(timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</time><Check size={18} aria-hidden="true" /><div><Link to={`/coordinator/trips/${item.trip.id}`}>{item.trip.id}</Link> {item.trip.status === 'Completed' ? 'completed' : 'started'}<small>{item.trip.status === 'Completed' ? `Final odometer ${item.trip.finalOdometer.toLocaleString()} km` : item.trip.startingOdometer !== undefined ? `Start odometer ${item.trip.startingOdometer.toLocaleString()} km` : 'Starting odometer not recorded'}</small></div><StatusBadge>{item.trip.status}</StatusBadge></div>) : <p className="coord-card-body">No recorded trip updates today.</p>}</CoordinatorCard>
      <CoordinatorCard title="Needs attention" subtitle={`${attention.length} items`}>{attention.length ? attention.slice(0, 4).map(({ item, title, description }) => <div className="coord-attention-item" key={item.trip.id}><AlertTriangle size={20} aria-hidden="true" /><div><h3>{title}</h3><p>{description}</p><Link className="coord-button secondary small" to={`/coordinator/trips/${item.trip.id}`}>View trip</Link></div></div>) : <p className="coord-card-body">No trips need attention.</p>}</CoordinatorCard>
    </div>
    <CoordinatorCard title="All trips" subtitle="Open a trip to see its details and manage it" action={<div className="coord-actions"><label className="coord-search"><Search size={16} aria-hidden="true" /><input aria-label="Search trips" placeholder="Search trips" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} /></label><select className="coord-input" aria-label="Sort trips" value={sort} onChange={(event) => setSort(event.target.value)}><option value="time">Sort: start time</option><option value="id">Sort: trip ID</option></select></div>}>
      <nav className="coord-tabs coord-trip-tabs" aria-label="Trip status">{(['In Progress', 'Assigned', 'Draft', 'Completed', 'Cancelled'] as const).map((value) => <button key={value} className={status === value ? 'active' : ''} aria-current={status === value ? 'page' : undefined} onClick={() => { setStatus(value); setPage(0) }}>{value}<span>{data.items.filter((item) => item.trip.status === value).length}</span></button>)}</nav>
      {!items.length ? <EmptyState title="No matching trips" description="Try a different status or search." /> : <div className="coord-table-scroll"><table className="coord-table coord-trip-table"><caption className="sr-only">Fleet trips</caption><thead><tr>{['Trip', 'Route', 'Vehicle & driver', 'Mechanic', 'Scheduled', 'Started', 'Status', 'Actions'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{items.slice(currentPage * 8, currentPage * 8 + 8).map((item) => <tr key={item.trip.id}><td><Link className="coord-mono" to={`/coordinator/trips/${item.trip.id}`}>{item.trip.id}</Link><small>{item.order.company.name}</small></td><td>{item.order.order.origin} → {item.order.order.destination}</td><td><span className="coord-mono">{item.vehicle.registration}</span><small>{item.driver.user.name}</small></td><td>{item.mechanic.user.name}</td><td>{formatDate(item.trip.scheduledStart)}</td><td>{formatDate(item.trip.actualStartAt)}<small>{item.trip.startingOdometer !== undefined ? `${item.trip.startingOdometer.toLocaleString()} km` : '—'}</small></td><td><StatusBadge>{item.trip.status}</StatusBadge></td><td><Link className="coord-button secondary small" to={`/coordinator/trips/${item.trip.id}`}>View</Link></td></tr>)}</tbody></table></div>}
      {pages > 1 && <nav className="coord-pagination" aria-label="Trip pages"><Button variant="outline" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>Page {currentPage + 1} of {pages}</span><Button variant="outline" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</Button></nav>}
    </CoordinatorCard>
  </div>
}
