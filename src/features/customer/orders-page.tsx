import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Search } from 'lucide-react'
import { applicationServices } from '../../services/application-services'
import type { CustomerWorkspace } from '../../types/customer'
import { LoadingState, ErrorState, EmptyState } from '../../components/ui/page-states'
import { useCoordinatorQuery } from '../coordinator/use-coordinator-query'
import { CustomerStatus } from './customer-components'
import { customerDate, customerMoney, customerOrderStatus, customerOrderTabs, matchesCustomerTab, orderAmount, type CustomerOrderTab } from './customer-format'
import './customer.css'

export function CustomerOrdersPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getCustomerWorkspace)
  if (!result) return <div className="coord-page"><LoadingState label="Loading your orders…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <CustomerOrders data={result.data} />
}
export function CustomerOrders({ data }: { data: CustomerWorkspace }) {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<CustomerOrderTab>('All')
  const [period, setPeriod] = useState('3')
  const [page, setPage] = useState(0)
  const search = params.get('q') ?? ''
  const cutoff = new Date(data.capturedAt)
  if (period !== 'all') cutoff.setUTCMonth(cutoff.getUTCMonth() - Number(period))
  const filtered = data.orders.filter((item) => matchesCustomerTab(item, tab) && `${item.order.id} ${item.order.origin} ${item.order.destination}`.toLowerCase().includes(search.toLowerCase()) && (period === 'all' || Date.parse(item.order.createdAt) >= cutoff.getTime()))
  const pages = Math.max(1, Math.ceil(filtered.length / 7)); const currentPage = Math.min(page, pages - 1)
  return <div className="coord-page"><div className="coord-page-heading"><div><h1>My orders</h1><p>Every transport order you have placed for {data.company.name}, with its current status.</p></div><Link className="coord-button" to="/customer/orders/new">New transport order</Link></div><section className="coord-card">
    <nav className="coord-tabs" aria-label="Order status filters">{customerOrderTabs.map((value) => <button key={value} className={tab === value ? 'active' : ''} aria-current={tab === value ? 'page' : undefined} onClick={() => { setTab(value); setPage(0) }}>{value}<span>{data.orders.filter((item) => matchesCustomerTab(item, value)).length}</span></button>)}</nav>
    <div className="customer-order-filters"><label className="customer-search"><Search size={15} aria-hidden="true" /><input aria-label="Search order number or city" placeholder="Search order number or city" value={search} onChange={(event) => { setParams(event.target.value ? { q: event.target.value } : {}); setPage(0) }} /></label><select className="coord-input" aria-label="Order period" value={period} onChange={(event) => { setPeriod(event.target.value); setPage(0) }}><option value="all">All time</option><option value="3">Last 3 months</option><option value="1">Last month</option></select><span>Showing {Math.min(7, Math.max(0, filtered.length - currentPage * 7))} of {filtered.length}</span></div>
    {filtered.length ? <div className="customer-table-scroll"><table className="customer-orders-table"><caption className="sr-only">Your transport orders</caption><thead><tr>{['Order', 'Route', 'Cargo', 'Pickup', 'Amount', 'Status', 'Action'].map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{filtered.slice(currentPage * 7, currentPage * 7 + 7).map((item) => { const amount = orderAmount(item); return <tr key={item.order.id}><td><span className="coord-mono">{item.order.id}</span><small>{customerDate(item.order.createdAt)}</small></td><td>{item.order.origin} → {item.order.destination}</td><td>{item.order.cargo}{item.order.weightTonnes ? ` · ${item.order.weightTonnes} t` : ''}</td><td>{customerDate(item.order.pickupAt)}</td><td>{amount === undefined ? '—' : customerMoney(amount)}</td><td><CustomerStatus>{customerOrderStatus(item)}</CustomerStatus></td><td><Link className="coord-button secondary small" to={`/customer/orders/${item.order.id}`}>View</Link></td></tr> })}</tbody></table></div> : <EmptyState title="No matching orders" description="Try another filter or create a new transport order." />}
    <div className="customer-pagination"><span>Page {currentPage + 1} of {pages}</span><button className="coord-button secondary small" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="coord-button secondary small" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
  </section></div>
}
