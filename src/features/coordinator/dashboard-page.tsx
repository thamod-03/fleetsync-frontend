import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { Activity, Plus, Truck, Users, Wrench } from 'lucide-react'
import { useDemoUser } from '../../hooks/use-demo'
import { applicationServices } from '../../services/application-services'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/page-states'
import type { CoordinatorOverview } from '../../types/coordinator'
import { CoordinatorCard, StatusBadge } from './coordinator-components'
import { money, orderStatus } from './coordinator-format'
import { useCoordinatorQuery } from './use-coordinator-query'

const later = 'Currently unavailable'
function Deferred({ children }: { children: ReactNode }) { return <button type="button" className="coord-link" disabled title={later}>{children}</button> }

export function CoordinatorDashboardPage() {
  const user = useDemoUser()
  const { result, retry } = useCoordinatorQuery(applicationServices.getCoordinatorOverview)
  if (!result) return <div className="coord-page"><LoadingState label="Loading operational dashboard…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <CoordinatorDashboard data={result.data} name={user?.name.split(' ')[0] ?? ''} />
}

export function CoordinatorDashboard({ data, name }: { data: CoordinatorOverview; name: string }) {
  const waiting = data.orders.filter((item) => item.order.status === 'Submitted')
  const progressing = data.trips.filter((item) => item.trip.status === 'In Progress')
  const vehicles = data.vehicles.filter((item) => item.available)
  const drivers = data.drivers.filter((item) => item.available)
  const hour = new Date(data.capturedAt).getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const oldest = waiting.at(-1)
  const hours = oldest ? Math.max(0, Math.floor((Date.parse(data.capturedAt) - Date.parse(oldest.order.createdAt)) / 3600000)) : 0
  const kpis = [
    { label: 'Orders to quote', value: waiting.length, meta: oldest ? `Oldest waiting ${hours} hours` : 'No orders waiting', icon: Wrench, tone: 'pending' },
    { label: 'Trips in progress', value: progressing.length, meta: 'Started by drivers', icon: Activity, tone: 'info' },
    { label: 'Vehicles available', value: vehicles.length, meta: `of ${data.vehicles.length} vehicles`, icon: Truck, tone: 'neutral' },
    { label: 'Drivers available', value: drivers.length, meta: `of ${data.drivers.length} drivers`, icon: Users, tone: 'success' },
  ]
  return <div className="coord-page">
    <div className="coord-page-heading"><div><h1>{greeting}, {name}</h1><p>{waiting.length} {waiting.length === 1 ? 'order needs' : 'orders need'} a fare quotation.</p></div><div className="coord-actions"><button className="coord-button secondary" disabled title={later}>Generate report</button><Link className="coord-button" to="/coordinator/trips/create"><Plus size={16} />Create trip</Link></div></div>
    <div className="coord-kpis">{kpis.map(({ label, value, meta, icon: Icon, tone }) => <section key={label} className="coord-kpi"><span className={`coord-icon coord-badge-${tone}`}><Icon size={20} aria-hidden="true" /></span><div><h2>{label}</h2><strong>{value}</strong><p>{meta}</p></div></section>)}</div>
    <div className="coord-middle-grid">
      <CoordinatorCard title="Orders waiting for you" subtitle="Newest first" action={<Link className="coord-link" to="/coordinator/orders">All orders</Link>}>
        {data.orders.length ? data.orders.slice(0, 4).map((item) => <div className="coord-order-row" key={item.order.id}><div><span className="coord-mono">{item.order.id}</span><small>{new Date(item.order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</small></div><div><strong>{item.company.name}</strong><small>{item.order.origin} → {item.order.destination}</small></div><StatusBadge>{orderStatus(item)}</StatusBadge><Link className={`coord-button small ${item.order.status === 'Submitted' ? '' : 'secondary'}`} to={`/coordinator/orders/${item.order.id}`}>{item.order.status === 'Submitted' ? 'Prepare quote' : 'View'}</Link></div>) : <EmptyState title="No submitted orders" description="New customer orders will appear here." />}
      </CoordinatorCard>
      <CoordinatorCard title="Active trips" subtitle={`${progressing.length} in progress`} action={<Deferred>View trips</Deferred>}><div className="coord-card-body">{data.trips.length ? data.trips.slice(0, 4).map(({ trip, order, driver }) => <div key={trip.id} className="coord-trip"><div><Link className="coord-mono" to={`/coordinator/trips/${trip.id}/assigned`}>{trip.id}</Link><span>{order.origin} → {order.destination}</span></div><p>{trip.status} · {driver.name}</p></div>) : <p>No active trips.</p>}</div></CoordinatorCard>
    </div>
    <div className="coord-bottom-grid">
      <CoordinatorCard title="Availability today" subtitle="Checked before a trip is assigned" action={<Link className="coord-link" to="/coordinator/availability">Check availability</Link>}><div className="coord-card-body">{[{ label: 'Vehicles', free: vehicles.length, total: data.vehicles.length, description: vehicles.map((v) => v.description).join(' · ') }, { label: 'Drivers', free: drivers.length, total: data.drivers.length, description: `${data.mechanics.filter((m) => m.available).length} mechanics available` }].map((item) => <div className="coord-availability" key={item.label}><div><span>{item.label}</span><strong>{item.free} of {item.total} free</strong></div><meter aria-label={`${item.label} available`} min={0} max={item.total || 1} value={item.free} /><p>{item.description || 'None available'}</p></div>)}</div></CoordinatorCard>
      <CoordinatorCard title="Order payments" subtitle="All recorded orders" action={<Link className="coord-link" to="/coordinator/orders">View all</Link>}><div className="coord-card-body">{['Paid', 'Awaiting payment', 'Payment failed'].map((status) => { const orders = data.orders.filter((item) => orderStatus(item) === status); const amount = orders.reduce((sum, item) => sum + (status === 'Awaiting payment' ? item.quotations.filter((quote) => quote.status === 'Accepted').reduce((a, q) => a + q.amount, 0) : item.payments.filter((payment) => payment.status === (status === 'Paid' ? 'Succeeded' : 'Failed')).reduce((a, p) => a + p.amount, 0)), 0); return <div className="coord-payment-row" key={status}><StatusBadge>{status}</StatusBadge><span>{orders.length} {orders.length === 1 ? 'order' : 'orders'}</span><span className="coord-mono">{money(amount)}</span></div> })}</div></CoordinatorCard>
      <CoordinatorCard title="Operational report" subtitle="Trips, distance and on-time rate"><div className="coord-card-body"><p>No operational report generated.</p><div className="coord-actions"><button className="coord-button secondary small" disabled title={later}>Generate</button><button className="coord-button secondary small" disabled title={later}>Export</button></div></div></CoordinatorCard>
    </div>
  </div>
}
