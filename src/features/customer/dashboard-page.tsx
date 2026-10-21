import { Link } from 'react-router'
import { Activity, TrendingUp, Truck, Users } from 'lucide-react'
import { applicationServices } from '../../services/application-services'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/page-states'
import type { CustomerWorkspace } from '../../types/customer'
import { useCoordinatorQuery } from '../coordinator/use-coordinator-query'
import { CustomerCard, CustomerStatus, TripSummary } from './customer-components'
import { customerDate, customerMoney, customerOrderStatus } from './customer-format'
import './customer.css'

export function CustomerDashboardPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getCustomerWorkspace)
  if (!result) return <div className="coord-page"><LoadingState label="Loading your dashboard…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <CustomerDashboard data={result.data} />
}
export function CustomerDashboard({ data }: { data: CustomerWorkspace }) {
  const quotations = data.orders.flatMap((item) => item.quotations.filter((quote) => quote.status === 'Pending').map((quote) => ({ quote, order: item.order })))
  const active = data.trips.filter((item) => item.trip.status === 'In Progress')
  const month = data.capturedAt.slice(0, 7)
  const completed = data.trips.filter((item) => item.trip.status === 'Completed' && item.trip.actualReturnDate.slice(0, 7) === month)
  const payments = data.orders.flatMap((item) => item.payments.filter((payment) => payment.status === 'Succeeded').map((payment) => ({ payment, order: item.order })))
  const hour = new Date(data.capturedAt).getHours()
  const firstQuote = quotations[0]
  const trip = active[0] ?? data.trips.find((item) => item.trip.status === 'Assigned')
  const kpis = [
    { label: 'Open orders', value: data.orders.filter((item) => !['Completed', 'Cancelled', 'Quote declined'].includes(customerOrderStatus(item))).length, note: 'Not yet completed', icon: Activity, tone: 'info' },
    { label: 'Quotations to review', value: quotations.length, note: firstQuote ? `${firstQuote.order.id} · ${customerMoney(firstQuote.quote.amount)}` : 'No quotations waiting', icon: TrendingUp, tone: 'accent' },
    { label: 'Trips in progress', value: active.length, note: active[0]?.trip.id ?? 'No trips in progress', icon: Users, tone: 'success' },
    { label: 'Completed this month', value: completed.length, note: 'Recorded completed trips', icon: Truck, tone: 'neutral' },
  ]
  return <div className="coord-page"><div className="coord-page-heading"><div><h1>{hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'}, {data.user.name.split(' ')[0]}</h1><p>{data.company.name} · {quotations.length} {quotations.length === 1 ? 'quotation is' : 'quotations are'} waiting for your answer.</p></div><Link to="/customer/orders/new" className="coord-button">New transport order</Link></div>
    <div className="coord-kpis">{kpis.map(({ label, value, note, icon: Icon, tone }) => <section className="coord-kpi" key={label}><span className={`coord-icon coord-badge-${tone}`}><Icon size={20} aria-hidden="true" /></span><div><h2>{label}</h2><strong>{value}</strong><p>{note}</p></div></section>)}</div>
    {firstQuote && <div className="customer-quote-alert"><div><strong>Your fare quotation for {firstQuote.order.id} is ready</strong><p>{firstQuote.order.origin} → {firstQuote.order.destination} · {customerMoney(firstQuote.quote.amount)}{firstQuote.quote.validUntil ? ` · valid until ${customerDate(firstQuote.quote.validUntil)}` : ''}</p></div><Link className="coord-button" to={`/customer/quotations/${firstQuote.quote.id}`}>Review quotation</Link></div>}
    <div className="customer-dashboard-grid"><CustomerCard title="My orders" subtitle="Latest first" action={<Link className="coord-link" to="/customer/orders">View all</Link>}>{data.orders.length ? data.orders.slice(0, 4).map((item) => <div className="customer-recent-order" key={item.order.id}><div><span className="coord-mono">{item.order.id}</span><small>{customerDate(item.order.createdAt)}</small></div><div>{item.order.origin} → {item.order.destination}<small>{item.order.weightTonnes ? `${item.order.weightTonnes} t · ` : ''}{item.order.cargo}</small></div><CustomerStatus>{customerOrderStatus(item)}</CustomerStatus><Link className="coord-button secondary small" to={`/customer/orders/${item.order.id}`}>View</Link></div>) : <div className="coord-card-body"><EmptyState title="No orders yet" description="Create a transport order to arrange your first delivery." action={<Link className="coord-button" to="/customer/orders/new">New transport order</Link>} /></div>}</CustomerCard>
      <div className="customer-column"><CustomerCard title={trip ? trip.trip.status === 'In Progress' ? 'Trip in progress' : 'Assigned trip' : 'Trip information'} subtitle={trip ? `${trip.trip.orderId} · ${trip.trip.id}` : undefined} action={trip && <CustomerStatus>{trip.trip.status}</CustomerStatus>}><div className="coord-card-body">{trip ? <TripSummary info={trip} /> : <p>No active trips.</p>}</div></CustomerCard>
      <CustomerCard title="Recent payments" action={<Link className="coord-link" to="/customer/payments">All payments</Link>}>{payments.length ? payments.slice(0, 3).map(({ payment, order }) => <div className="customer-payment-row" key={payment.id}><div><span className="coord-mono">{order.id}</span><small>Payment recorded</small></div><strong>{customerMoney(payment.amount)}</strong><Link className="coord-link" to={`/customer/payments/${payment.id}/invoice`}>Invoice</Link></div>) : <p className="coord-card-body">No recorded payments.</p>}</CustomerCard></div>
    </div>
  </div>
}
