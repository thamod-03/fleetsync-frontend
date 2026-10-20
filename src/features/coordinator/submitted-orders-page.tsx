import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Search } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/page-states'
import { applicationServices } from '../../services/application-services'
import type { OrderDetails } from '../../types/coordinator'
import { StatusBadge } from './coordinator-components'
import { filterOrders, formatDate, matchesTab, ordersCsv, orderTabs, paymentStatus, workflowStatus, type OrderTab } from './coordinator-format'
import { useCoordinatorQuery } from './use-coordinator-query'

export function SubmittedOrdersPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getSubmittedOrders)
  if (!result) return <div className="coord-page"><LoadingState label="Loading submitted orders…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <SubmittedOrders orders={result.data} />
}

export function SubmittedOrders({ orders }: { orders: OrderDetails[] }) {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<OrderTab>('All open')
  const [pickup, setPickup] = useState('')
  const [payment, setPayment] = useState('')
  const [page, setPage] = useState(0)
  const search = params.get('q') ?? ''
  const filtered = filterOrders(orders, { tab, search, pickup, payment })
  const pages = Math.max(1, Math.ceil(filtered.length / 8))
  const activePage = Math.min(page, pages - 1)
  const start = activePage * 8
  const pickupDates = [...new Set(orders.flatMap((item) => item.order.pickupAt ? [new Date(item.order.pickupAt).toLocaleDateString('en-CA')] : []))].sort()
  const exportOrders = () => {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + ordersCsv(filtered)], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'fleetsync-orders.csv'
    document.body.append(anchor); anchor.click(); anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return <div className="coord-page">
    <div className="coord-page-heading"><div><h1>Submitted orders</h1><p>Transport orders from customers. Quote new orders, then create a trip once the customer has paid.</p></div><Button className="coord-button secondary" onClick={exportOrders} disabled={!filtered.length}>Export</Button></div>
    <nav className="coord-tabs" aria-label="Order groups">{orderTabs.map((value) => <button key={value} className={value === tab ? 'active' : ''} aria-current={value === tab ? 'page' : undefined} onClick={() => { setTab(value); setPage(0) }}>{value}<span>{orders.filter((item) => matchesTab(item, value)).length}</span></button>)}</nav>
    <section className="coord-card" aria-label="Submitted orders">
      <div className="coord-table-filters">
        <label className="coord-search"><Search size={16} aria-hidden="true" /><input aria-label="Search order ID, customer or place" placeholder="Search order ID, customer or place" value={search} onChange={(event) => { setParams((previous) => { const next = new URLSearchParams(previous); if (event.target.value) next.set('q', event.target.value); else next.delete('q'); return next }, { replace: true }); setPage(0) }} /></label>
        <select className="coord-input" aria-label="Pickup date" value={pickup} onChange={(event) => { setPickup(event.target.value); setPage(0) }}><option value="">Any pickup date</option>{pickupDates.map((date) => <option key={date} value={date}>{date}</option>)}</select>
        <select className="coord-input" aria-label="Payment status" value={payment} onChange={(event) => { setPayment(event.target.value); setPage(0) }}><option value="">All payment statuses</option>{['Not due yet', 'Awaiting payment', 'Paid', 'Payment failed'].map((value) => <option key={value}>{value}</option>)}</select>
        <span className="coord-result-count" role="status">Showing {filtered.length ? start + 1 : 0}–{Math.min(start + 8, filtered.length)} of {filtered.length}</span>
      </div>
      {!filtered.length ? <EmptyState title="No orders found" description="Try another order group, search or filter." action={<Button variant="outline" onClick={() => { setTab('All open'); setPickup(''); setPayment(''); setParams({}); setPage(0) }}>Clear filters</Button>} /> : <div className="coord-table-scroll"><table className="coord-table"><caption className="sr-only">Submitted customer transport orders</caption><thead><tr>{['Order', 'Customer', 'Route & pickup', 'Cargo', 'Payment', 'Status', 'Actions'].map((title) => <th key={title} scope="col">{title}</th>)}</tr></thead><tbody>{filtered.slice(start, start + 8).map((item) => <tr key={item.order.id}>
        <td><Link className="coord-order-id coord-mono" to={`/coordinator/orders/${item.order.id}`}>{item.order.id}</Link><small>{formatDate(item.order.createdAt)}</small></td>
        <td>{item.company.name}</td><td>{item.order.origin} → {item.order.destination}<small>Pickup {formatDate(item.order.pickupAt)}</small></td>
        <td>{item.order.cargo}<small>{item.order.weightTonnes ? `${item.order.weightTonnes} t` : item.order.pallets ?? 'Not provided'}</small></td>
        <td><StatusBadge>{paymentStatus(item)}</StatusBadge></td><td><StatusBadge>{workflowStatus(item)}</StatusBadge></td>
        <td>{item.trips.some((trip) => trip.status !== 'Cancelled') ? <Button className="coord-button secondary small" disabled title="Currently unavailable">View trip</Button> : paymentStatus(item) === 'Paid' ? <Button className="coord-button small" disabled title="Currently unavailable">Create trip</Button> : <Link className={`coord-button small ${item.order.status === 'Submitted' ? '' : 'secondary'}`} to={`/coordinator/orders/${item.order.id}`}>{item.order.status === 'Submitted' ? 'Prepare quote' : 'View'}</Link>}</td>
      </tr>)}</tbody></table></div>}
      {pages > 1 && <nav className="coord-pagination" aria-label="Order pages"><Button variant="outline" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>Previous</Button><span>Page {activePage + 1} of {pages}</span><Button variant="outline" disabled={activePage === pages - 1} onClick={() => setPage(activePage + 1)}>Next</Button></nav>}
    </section>
  </div>
}
