import { useCallback } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { ChevronLeft, Check } from 'lucide-react'
import { applicationServices } from '../../services/application-services'
import type { CustomerOrderDetails } from '../../types/customer'
import { LoadingState, ErrorState } from '../../components/ui/page-states'
import { useCoordinatorQuery } from '../coordinator/use-coordinator-query'
import { CustomerCard, CustomerStatus, TripSummary, UnavailableAction } from './customer-components'
import { customerDate, customerMoney, customerOrderStatus } from './customer-format'
import './customer.css'

export function CustomerOrderDetailsPage() {
  const { orderId = '' } = useParams()
  const location = useLocation()
  const query = useCallback(() => applicationServices.getCustomerOrder(orderId), [orderId])
  const { result, retry } = useCoordinatorQuery(query)
  if (!result) return <div className="coord-page"><LoadingState label="Loading your order…" /></div>
  if (!result.ok) return <div className="coord-page"><Link className="coord-link" to="/customer/orders">Back to my orders</Link><ErrorState message={result.error} onRetry={retry} /></div>
  return <CustomerOrderDetail data={result.data} submitted={location.state?.orderSubmitted === true} />
}
export function CustomerOrderDetail({ data, submitted = false }: { data: CustomerOrderDetails; submitted?: boolean }) {
  const { details } = data
  const { order } = details
  const trip = data.trips.at(-1)
  const quote = details.quotations.at(-1)
  const payment = details.payments.find((item) => item.status === 'Succeeded') ?? details.payments.at(-1)
  const stages = [
    { label: 'Submitted', reached: true, note: customerDate(order.createdAt) },
    { label: 'Quoted', reached: !!quote, note: quote ? customerMoney(quote.amount) : 'Not yet' },
    { label: 'Paid', reached: payment?.status === 'Succeeded', note: payment?.status === 'Succeeded' ? 'Payment recorded' : 'Not yet' },
    { label: 'Trip assigned', reached: !!trip && trip.trip.status !== 'Draft', note: customerDate(trip?.trip.status === 'Draft' ? undefined : trip?.trip.createdAt) },
    { label: 'In progress', reached: !!trip?.trip.actualStartAt || trip?.trip.status === 'In Progress' || trip?.trip.status === 'Completed', note: customerDate(trip?.trip.actualStartAt) },
    { label: trip?.trip.status === 'Cancelled' ? 'Cancelled' : 'Completed', reached: trip?.trip.status === 'Completed' || trip?.trip.status === 'Cancelled', note: customerDate(trip?.trip.status === 'Completed' ? trip.trip.actualReturnDate : trip?.trip.cancelledAt) },
  ]
  return <div className="coord-page"><nav className="coord-breadcrumb" aria-label="Breadcrumb"><Link to="/customer/orders"><ChevronLeft size={14} aria-hidden="true" />My orders</Link><span>/</span><span className="coord-mono">{order.id}</span></nav><div className="coord-page-heading"><div><div className="coord-title-row"><h1>Order {order.id}</h1><CustomerStatus>{customerOrderStatus(details)}</CustomerStatus></div><p>Placed {customerDate(order.createdAt)} · {order.origin} → {order.destination}{order.weightTonnes ? ` · ${order.weightTonnes} t ${order.cargo}` : ` · ${order.cargo}`}</p></div><div className="coord-actions"><UnavailableAction>Download invoice</UnavailableAction><UnavailableAction className="coord-button">Open chat</UnavailableAction></div></div>
    {submitted && <p className="coord-confirmation" role="status">Order submitted. A coordinator can now review it.</p>}
    <ol className="customer-order-stages" aria-label="Order lifecycle">{stages.map((stage, index) => <li key={stage.label} className={stage.reached ? 'complete' : ''}><span>{stage.reached ? <Check size={14} aria-hidden="true" /> : index + 1}</span><div><strong>{stage.label}</strong><small>{stage.note}</small></div></li>)}</ol>
    <div className="customer-details-grid"><div className="customer-column"><CustomerCard title="Trip status" subtitle={trip?.trip.id} action={trip && <CustomerStatus>{trip.trip.status}</CustomerStatus>}><div className="coord-card-body">{trip ? <TripSummary info={trip} orderLink={false} /> : <p>No trip assigned yet.</p>}<h3>Updates</h3>{data.activity.length ? <ol className="customer-timeline">{data.activity.map((event) => <li key={event.id} className="recorded"><strong>{event.action}</strong><small>{customerDate(event.createdAt)}</small></li>)}</ol> : <p>No additional updates recorded.</p>}</div></CustomerCard>
      <CustomerCard title="Route and cargo"><div className="coord-card-body"><dl className="customer-route-grid"><div><dt>Pickup</dt><dd>{order.pickupAddress ?? order.origin}</dd><small>{order.origin} · {customerDate(order.pickupAt)}</small>{order.pickupContactName && <small>{order.pickupContactName} · {order.pickupContactPhone}</small>}</div><div><dt>Destination</dt><dd>{order.destinationAddress ?? order.destination}</dd><small>{order.destination} · {order.deliveryBy ? customerDate(order.deliveryBy) : order.deliveryInstructions ?? 'Delivery time not recorded'}</small>{order.receiverName && <small>{order.receiverName} · {order.receiverPhone}</small>}</div></dl><dl className="customer-cargo-facts">{[['Cargo', order.cargo], ['Weight', order.weightTonnes ? `${(order.weightTonnes * 1000).toLocaleString()} kg` : 'Not recorded'], ['Pallets', order.pallets ?? 'Not recorded'], ['Handling', order.handling || 'None recorded']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{order.cargoDescription && <p>{order.cargoDescription}</p>}{order.customerNote && <p><strong>Note for the coordinator:</strong> {order.customerNote}</p>}</div></CustomerCard>
    </div><aside className="customer-column"><CustomerCard title="Payment" action={payment && <CustomerStatus>{payment.status === 'Succeeded' ? 'Paid' : payment.status}</CustomerStatus>}><div className="coord-card-body"><dl className="customer-payment-details"><div><dt>Fare quotation</dt><dd>{quote ? customerMoney(quote.amount) : 'Not issued'}</dd></div><div><dt>Quotation status</dt><dd>{quote?.status ?? 'Not recorded'}</dd></div><div><dt>Payment status</dt><dd>{payment?.status ?? 'Not recorded'}</dd></div><div><dt>Paid on</dt><dd>Not recorded</dd></div><div><dt>Method</dt><dd>Not recorded</dd></div><div><dt>Reference</dt><dd>{payment?.id ?? 'Not recorded'}</dd></div></dl><UnavailableAction>Download invoice</UnavailableAction>{quote?.status === 'Pending' && <UnavailableAction>Review quotation</UnavailableAction>}</div></CustomerCard><CustomerCard title="Questions about this order?"><div className="coord-card-body"><p>Chat with the coordinator, driver or mechanic in this order’s chat room.</p><UnavailableAction>Open chat</UnavailableAction></div></CustomerCard></aside>
    </div>
  </div>
}
