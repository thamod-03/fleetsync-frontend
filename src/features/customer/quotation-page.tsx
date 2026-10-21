import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { applicationServices } from '../../services/application-services'
import type { CustomerQuotation } from '../../types/customer-billing'
import { ErrorState, EmptyState, LoadingState } from '../../components/ui/page-states'
import { useCoordinatorQuery } from '../coordinator/use-coordinator-query'
import { CustomerCard, CustomerStatus } from './customer-components'
import { BillingBreadcrumb, QuotationOrder } from './billing-components'
import { customerDate, customerMoney } from './customer-format'
import clock from '../../assets/customer-billing/quote-clock.svg'
import './billing.css'

export function CustomerQuotationsPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getCustomerQuotations)
  return <div className="coord-page"><div className="coord-page-heading"><div><h1>Quotations</h1><p>Fare quotations for your transport orders.</p></div></div>{!result ? <LoadingState /> : !result.ok ? <ErrorState message={result.error} onRetry={retry} /> : !result.data.length ? <EmptyState title="No quotations yet" description="Published quotations will appear here after your order is reviewed." /> : <CustomerCard title="Fare quotations"><div className="customer-table-scroll"><table className="customer-orders-table"><thead><tr><th>Quotation</th><th>Order</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{result.data.map(({ quotation, details }) => <tr key={quotation.id}><td>{quotation.id}<small>{customerDate(quotation.publishedAt ?? quotation.createdAt)}</small></td><td>{details.order.id}<small>{details.order.origin} → {details.order.destination}</small></td><td>{customerMoney(quotation.amount)}</td><td><CustomerStatus>{quotation.status === 'Pending' ? 'Quoted' : quotation.status}</CustomerStatus></td><td><Link className="coord-link" to={`/customer/quotations/${quotation.id}`}>View quotation</Link></td></tr>)}</tbody></table></div></CustomerCard>}</div>
}
export function CustomerQuotationPage() {
  const { quotationId = '' } = useParams()
  const query = useCallback(() => applicationServices.getCustomerQuotation(quotationId), [quotationId])
  const { result, retry } = useCoordinatorQuery(query)
  if (!result) return <div className="coord-page"><LoadingState /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /><Link className="coord-link" to="/customer/quotations">Back to quotations</Link></div>
  return <QuotationDetail key={quotationId} data={result.data} />
}
export function QuotationDetail({ data }: { data: CustomerQuotation }) {
  const { quotation: quote, details } = data
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [requestId] = useState(() => crypto.randomUUID())
  const charges = quote.charges
  const success = details.payments.find((item) => item.status === 'Succeeded')
  const decide = async (decision: 'Accepted' | 'Declined') => {
    if (busy) return
    setBusy(true); setMessage(''); setError('')
    try {
      const result = await applicationServices.decideQuotation({ quotationId: quote.id, requestId, decision })
      if (!result.ok) setError(result.error)
      else if (decision === 'Accepted') navigate(`/customer/quotations/${quote.id}/payment`)
      else setMessage('Quotation declined. Your response has been saved.')
    } catch { setError('Your response could not be saved. Please try again.') }
    finally { setBusy(false) }
  }
  const chargeRows = [['distance', 'Distance charge', details.order.distanceKm ? `${details.order.distanceKm} km` : ''], ['load', 'Load charge', details.order.weightTonnes ? `${details.order.weightTonnes} t` : ''], ['loading', 'Loading and unloading', details.order.pallets ?? ''], ['handling', 'Handling', details.order.handling ?? ''], ['tolls', 'Tolls and fees', '']] as const
  return <div className="coord-page"><BillingBreadcrumb to="/customer/quotations" current={details.order.id}>Quotations</BillingBreadcrumb><div className="coord-page-heading"><div><div className="coord-title-row"><h1>Fare quotation for {details.order.id}</h1><CustomerStatus>{quote.status === 'Pending' ? 'Quoted' : quote.status}</CustomerStatus></div><p>{data.publishedBy ? `Published by ${data.publishedBy}, Operational Coordinator` : 'Published quotation'} · {customerDate(quote.publishedAt ?? quote.createdAt)}</p></div></div>
    {quote.validUntil && <div className="billing-validity"><img src={clock} alt="" /><span><strong>Valid until {customerDate(quote.validUntil)}</strong></span></div>}
    {error && <ErrorState message={error} />}{message && <p className="coord-confirmation" role="status">{message}</p>}
    <div className="billing-grid"><div className="customer-column"><CustomerCard title="Price breakdown" subtitle={quote.vehicleType}>{charges ? chargeRows.map(([key, label, note]) => <div className="billing-charge" key={key}><div>{label}{note && <small>{note}</small>}</div><span className="coord-mono">{customerMoney(charges[key])}</span></div>) : <p className="coord-card-body">Fare breakdown not recorded.</p>}<div className="billing-charge total"><strong>Total</strong><strong className="coord-mono">{customerMoney(quote.amount)}</strong></div></CustomerCard><CustomerCard title="Message from the coordinator"><div className="coord-card-body"><p>{quote.message || 'No message recorded.'}</p><small className="coord-muted">{data.publishedBy} · {customerDate(quote.publishedAt ?? quote.createdAt)}</small></div></CustomerCard><QuotationOrder data={data} /></div>
      <aside className="customer-column"><section className="coord-card billing-pay-actions"><p>Amount to pay</p><strong className="billing-total">{customerMoney(quote.amount)}</strong>{quote.status === 'Pending' ? <><button className="coord-button" disabled={busy} onClick={() => void decide('Accepted')}>{busy ? 'Saving…' : 'Accept and pay'}</button><button className="coord-button secondary" disabled={busy} onClick={() => void decide('Declined')}>Decline quotation</button><small>Accepting takes you to payment.</small></> : quote.status === 'Accepted' ? <><p role="status">Your quotation is accepted.</p><Link className="coord-button" to={success ? `/customer/payments/${success.id}/success` : `/customer/quotations/${quote.id}/payment`}>{success ? 'View payment' : 'Continue to payment'}</Link></> : <p>This quotation has been declined.</p>}</section><CustomerCard title="Not sure about the price?"><div className="coord-card-body"><p>Ask the coordinator in this order’s chat room before you decide.</p><Link className="coord-button secondary small" to={`/customer/chat?orderId=${encodeURIComponent(details.order.id)}`}>Open chat</Link></div></CustomerCard></aside>
    </div></div>
}
