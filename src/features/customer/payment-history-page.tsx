import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { applicationServices } from '../../services/application-services'
import type { CustomerPayment } from '../../types/customer-billing'
import { ErrorState, EmptyState, LoadingState } from '../../components/ui/page-states'
import { useCoordinatorQuery } from '../coordinator/use-coordinator-query'
import { CustomerCard, CustomerStatus } from './customer-components'
import { InvoicePreview } from './billing-components'
import { filterPayments, paymentStatistics } from './payment-history'
import { customerDate, customerMoney } from './customer-format'
import fleet from '../../assets/customer-billing/fleet.svg'
import activity from '../../assets/customer-billing/activity.svg'
import alert from '../../assets/customer-billing/alert.svg'
import trend from '../../assets/customer-billing/trend.svg'
import './billing.css'

export function CustomerPaymentHistoryPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getCustomerPayments)
  if (!result) return <div className="coord-page"><LoadingState /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <PaymentHistory data={result.data} />
}
function SelectedInvoice({ id }: { id: string }) {
  const query = useCallback(() => applicationServices.getCustomerInvoice(id), [id])
  const { result, retry } = useCoordinatorQuery(query)
  return !result ? <LoadingState /> : !result.ok ? <ErrorState message={result.error} onRetry={retry} /> : <InvoicePreview data={result.data.transaction} reason={result.data.reason} />
}
export function PaymentHistory({ data }: { data: CustomerPayment[] }) {
  const [status, setStatus] = useState('all'); const [months, setMonths] = useState('all')
  const [search, setSearch] = useState(''); const [page, setPage] = useState(0)
  const [selected, setSelected] = useState('')
  const [now] = useState(() => new Date())
  const filtered = filterPayments(data, status, months, search, now)
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 6) - 1))
  const stats = paymentStatistics(data, now)
  const invoiceId = data.some(({ payment }) => payment.id === selected && payment.status === 'Succeeded') ? selected : filtered.find(({ payment }) => payment.status === 'Succeeded')?.payment.id
  const cards = [
    { label: `Paid in ${now.toLocaleString('en-GB', { month: 'long' })}`, value: customerMoney(stats.monthlyTotal), note: `${stats.monthlyCount} payments`, icon: fleet, tone: 'neutral' },
    { label: 'Last payment', value: stats.last ? customerMoney(stats.last.payment.amount) : 'Not recorded', note: stats.last ? `${stats.last.details.order.id} · ${customerDate(stats.last.payment.completedAt ?? stats.last.payment.createdAt)}` : 'No dated payments', icon: activity, tone: 'info' },
    { label: 'Failed attempts', value: String(stats.failures), note: 'This month · no funds transferred', icon: alert, tone: 'danger' },
    { label: 'Paid this year', value: customerMoney(stats.yearlyTotal), note: stats.undated ? `${stats.undated} undated payments excluded` : 'Recorded dated payments', icon: trend, tone: 'accent' },
  ]
  return <div className="coord-page"><div className="coord-page-heading"><div><h1>Payments</h1><p>Payment records for your transport orders.</p></div></div><div className="coord-kpis billing-kpis">{cards.map((item) => <section className="coord-kpi" key={item.label}><span className={`coord-icon coord-badge-${item.tone}`}><img src={item.icon} alt="" /></span><div><h2>{item.label}</h2><strong>{item.value}</strong><p>{item.note}</p></div></section>)}</div><div className="billing-history-grid"><CustomerCard title="Payment history" action={<div className="coord-actions billing-history-filters"><select className="coord-input" aria-label="Payment status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0) }}><option value="all">All statuses</option><option value="Succeeded">Paid</option><option>Pending</option><option>Failed</option></select><select className="coord-input" aria-label="Payment period" value={months} onChange={(event) => { setMonths(event.target.value); setPage(0) }}><option value="all">All time</option><option value="3">Last 3 months</option><option value="1">Last month</option><option value="12">Last year</option></select></div>}><div className="customer-order-filters"><label className="customer-search"><span className="sr-only">Search payments</span><input placeholder="Search order or payment reference" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} /></label></div><div className="customer-table-scroll"><table className="customer-orders-table billing-history-table"><thead><tr><th>Date</th><th>Order</th><th>Amount · ref</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filtered.slice(currentPage * 6, currentPage * 6 + 6).map(({ payment, details }) => <tr key={payment.id} className={invoiceId === payment.id ? 'selected' : ''}><td>{customerDate(payment.completedAt ?? payment.createdAt)}</td><td><Link className="coord-link coord-mono" to={`/customer/orders/${details.order.id}`}>{details.order.id}</Link><small>{details.order.origin} → {details.order.destination}</small></td><td className="coord-mono">{customerMoney(payment.amount)}<small>{payment.reference ?? payment.id}</small></td><td><CustomerStatus>{payment.status === 'Succeeded' ? 'Paid' : payment.status}</CustomerStatus><small>{payment.method ?? 'Method not recorded'}</small></td><td className="billing-payment-action">{payment.status === 'Succeeded' ? <button className="coord-button secondary small" onClick={() => setSelected(payment.id)}>Invoice<span className="sr-only"> for {payment.id}</span></button> : <Link className="coord-link" to={payment.status === 'Failed' ? `/customer/payments/${payment.id}/failed` : `/customer/quotations/${payment.quotationId}/payment`}>{payment.status === 'Failed' ? 'View' : 'Resume'}</Link>}</td></tr>)}</tbody></table></div>{!filtered.length && <EmptyState title="No payments found" description="Try another filter or review your accepted quotations." />}<div className="customer-pagination"><span>Showing {filtered.length ? currentPage * 6 + 1 : 0}–{Math.min((currentPage + 1) * 6, filtered.length)} of {filtered.length} payments</span><button className="coord-button secondary small" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><button className="coord-button secondary small" disabled={(currentPage + 1) * 6 >= filtered.length} onClick={() => setPage(currentPage + 1)}>Next</button></div></CustomerCard><aside>{invoiceId ? <SelectedInvoice id={invoiceId} /> : <CustomerCard title="Invoice preview"><p className="coord-card-body">Select a successful payment to view its record.</p></CustomerCard>}</aside></div></div>
}
