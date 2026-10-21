import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ChevronLeft, MapPin } from 'lucide-react'
import { ErrorState, LoadingState } from '../../components/ui/page-states'
import { applicationServices } from '../../services/application-services'
import type { OrderDetails } from '../../types/coordinator'
import { CoordinatorCard, StatusBadge } from './coordinator-components'
import { formatDate, workflowStatus } from './coordinator-format'
import { FareEstimation } from './fare-estimation'
import { useCoordinatorQuery } from './use-coordinator-query'

export function ReviewOrderPage() {
  const { orderId = '' } = useParams()
  const query = useCallback(() => applicationServices.getOrder(orderId), [orderId])
  const { result, retry } = useCoordinatorQuery(query)
  if (!result) return <div className="coord-page"><LoadingState label="Loading customer order…" /></div>
  if (!result.ok) return <div className="coord-page"><Link className="coord-link" to="/coordinator/orders">Back to submitted orders</Link><ErrorState message={result.error} onRetry={retry} /></div>
  return <ReviewOrder details={result.data} key={orderId} />
}

export function ReviewOrder({ details }: { details: OrderDetails }) {
  const [confirmation, setConfirmation] = useState('')
  const { order, customer, company, contact } = details
  return <div className="coord-page coord-review-page">
    <nav className="coord-breadcrumb" aria-label="Breadcrumb"><Link to="/coordinator/orders"><ChevronLeft size={14} aria-hidden="true" />Submitted orders</Link><span>/</span><span className="coord-mono">{order.id}</span></nav>
    <div className="coord-page-heading"><div><div className="coord-title-row"><h1>Review order {order.id}</h1><StatusBadge>{workflowStatus(details)}</StatusBadge></div><p>{company.name} · submitted {formatDate(order.createdAt)} · pickup {formatDate(order.pickupAt)}</p></div></div>
    {confirmation && <p className="coord-confirmation" role="status">{confirmation}</p>}
    <div className="coord-review-grid">
      <div className="coord-review-details">
        <CoordinatorCard title="Customer"><dl className="coord-detail-grid coord-card-body"><div><dt>Company</dt><dd>{company.name}</dd></div><div><dt>Contact</dt><dd>{contact.name}{customer.mobile ? ` · ${customer.mobile}` : ''}</dd></div><div><dt>Email</dt><dd>{contact.email}</dd></div><div><dt>Customer since</dt><dd>{customer.joinedAt ? new Date(customer.joinedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'Not recorded'} · {details.customerOrderCount} orders</dd></div></dl></CoordinatorCard>
        <CoordinatorCard title="Route"><div className="coord-card-body"><div className="coord-route-stop"><MapPin size={18} aria-hidden="true" /><div><p className="coord-field-label">Pickup</p><p>{order.pickupAddress ?? order.origin}</p><small>{order.origin} · {formatDate(order.pickupAt)}</small>{order.pickupContactName && <small>{order.pickupContactName} · {order.pickupContactPhone}</small>}</div></div><div className="coord-route-stop destination"><MapPin size={18} aria-hidden="true" /><div><p className="coord-field-label">Destination</p><p>{order.destinationAddress ?? order.destination}</p>{order.receiverName && <small>{order.receiverName} · {order.receiverPhone}</small>}<small>{order.deliveryBy ? `Deliver by ${formatDate(order.deliveryBy)}` : order.deliveryInstructions ?? 'Delivery time not provided'}</small></div></div><dl><dt>Distance</dt><dd>{order.distanceKm ? `${order.distanceKm} km` : 'Not provided'}</dd></dl></div></CoordinatorCard>
        <CoordinatorCard title="Cargo"><div className="coord-card-body"><dl className="coord-detail-grid"><div><dt>Type</dt><dd>{order.cargo}</dd></div><div><dt>Weight</dt><dd>{order.weightTonnes ? `${order.weightTonnes} t` : 'Not provided'}</dd></div><div><dt>Pallets</dt><dd>{order.pallets ?? 'Not provided'}</dd></div><div><dt>Handling</dt><dd>{order.handling ?? 'Not provided'}</dd></div></dl>{order.cargoDescription && <p>{order.cargoDescription}</p>}<div className="coord-customer-note"><p className="coord-field-label">Note from customer</p><p>{order.customerNote ?? 'No note provided.'}</p></div></div></CoordinatorCard>
      </div>
      <FareEstimation details={details} onSaved={(_, publish, emailDelivered) => setConfirmation(!publish ? 'Quotation draft saved.' : emailDelivered ? 'Quotation saved and email delivered.' : 'Quotation saved and available in the customer account. Email delivery is unavailable; no email was sent.')} />
    </div>
  </div>
}
