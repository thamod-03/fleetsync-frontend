import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Check, ChevronLeft, Info, MapPin, Truck, UserRound, Wrench } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { ErrorState, LoadingState } from '../../components/ui/page-states'
import { applicationServices } from '../../services/application-services'
import type { Trip } from '../../types/domain'
import type { ManagedTrip } from '../../types/trip-management'
import { CoordinatorCard, StatusBadge } from './coordinator-components'
import { formatDate, money, paymentStatus } from './coordinator-format'
import { useCoordinatorQuery } from './use-coordinator-query'
import { TripActionDialog } from './trip-action-dialog'

export function TripDetailsPage() {
  const { tripId = '' } = useParams()
  const location = useLocation()
  const query = useCallback(() => applicationServices.getTripDetails(tripId), [tripId])
  const { result, retry } = useCoordinatorQuery(query)
  if (!result) return <div className="coord-page"><LoadingState label="Loading trip details…" /></div>
  if (!result.ok) return <div className="coord-page"><Link className="coord-link" to="/coordinator/trips">Back to trips</Link><ErrorState message={result.error} onRetry={retry} /></div>
  return <TripDetails data={result.data} initialCancel={location.pathname.endsWith('/cancel')} key={`${tripId}:${location.pathname.endsWith('/cancel')}`} />
}

export function TripDetails({ data, initialCancel = false }: { data: ManagedTrip; initialCancel?: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const navigationState: unknown = location.state
  const navigationFeedback = navigationState && typeof navigationState === 'object' && 'tripFeedback' in navigationState && typeof navigationState.tripFeedback === 'string' ? navigationState.tripFeedback : ''
  const { trip, order, vehicle, driver, mechanic, actions } = data
  const [dialog, setDialog] = useState<{ kind: 'cancel' | 'complete'; trip: Trip } | null>(() => initialCancel && actions.cancel ? { kind: 'cancel', trip } : null)
  const [confirmation, setConfirmation] = useState('')
  const close = () => { setDialog(null); if (initialCancel) navigate(`/coordinator/trips/${trip.id}`, { replace: true }) }
  const saved = (updated: Trip) => {
    setConfirmation(`Trip ${updated.status.toLowerCase()}. Resources remain reserved. Notifications queued locally; no push notification was sent.`)
    setDialog(null)
    if (initialCancel) navigate(`/coordinator/trips/${trip.id}`, { replace: true, state: { tripFeedback: `Trip ${updated.status.toLowerCase()}. Resources remain reserved; no push notification was sent.` } })
  }
  const latestQuote = order.quotations.filter((quote) => quote.status !== 'Draft').at(-1)
  const steps = [
    { label: 'Draft', detail: 'Order review', time: undefined },
    { label: 'Assigned', detail: `${vehicle.registration} · ${driver.user.name}`, time: trip.createdAt },
    { label: 'In Progress', detail: trip.startingOdometer !== undefined ? `Started at ${trip.startingOdometer.toLocaleString()} km` : 'Driver has not started', time: trip.actualStartAt },
    { label: 'Completed', detail: trip.status === 'Completed' ? `Final odometer ${trip.finalOdometer.toLocaleString()} km` : 'Waiting for completion', time: trip.status === 'Completed' ? trip.actualReturnDate : undefined },
  ]
  const currentStep = ['Draft', 'Assigned', 'In Progress', 'Completed'].indexOf(trip.status)
  return <div className="coord-page">
    <nav className="coord-breadcrumb" aria-label="Breadcrumb"><Link to="/coordinator/trips"><ChevronLeft size={14} aria-hidden="true" />Trips</Link><span>/</span><span className="coord-mono">{trip.id}</span></nav>
    <div className="coord-page-heading"><div><div className="coord-title-row"><h1>Trip {trip.id}</h1><StatusBadge>{trip.status}</StatusBadge></div><p>{order.company.name} · {order.order.origin} → {order.order.destination} · order {trip.orderId}</p>{actions.completionUnavailableReason && <p><Info size={14} className="inline" aria-hidden="true" /> {actions.completionUnavailableReason}</p>}</div><div className="coord-actions"><Button className="coord-button secondary" disabled title="Chat is currently unavailable">Open chat</Button>{actions.complete && <Button className="coord-button secondary" onClick={() => setDialog({ kind: 'complete', trip })}>Mark completed</Button>}{actions.cancel && <Button className="coord-button danger" onClick={() => setDialog({ kind: 'cancel', trip })}>Cancel trip</Button>}</div></div>
    {(confirmation || navigationFeedback) && <p role="status" className="coord-confirmation">{confirmation || navigationFeedback}</p>}
    {initialCancel && !actions.cancel && <ErrorState message="This trip cannot be cancelled in its current status." />}
    {trip.status === 'Cancelled' ? <section className="coord-card coord-card-body"><h2 className="font-semibold">Trip cancelled</h2><p>{trip.cancellationReason ?? 'Cancellation reason not recorded'}{trip.cancellationDetails ? ` · ${trip.cancellationDetails}` : ''}</p><p className="coord-helper">{formatDate(trip.cancelledAt)}{trip.resourcesHeld ? ' · Resources remain reserved pending release.' : ''}</p></section> : <ol className="coord-trip-lifecycle">{steps.map((step, index) => <li key={step.label} className={index <= currentStep ? 'reached' : ''}><span className="coord-step-dot">{index < currentStep ? <Check size={14} aria-hidden="true" /> : index + 1}</span><div><strong>{step.label}</strong><small>{step.detail}</small><time>{step.time ? formatDate(step.time) : '—'}</time></div></li>)}</ol>}
    <div className="coord-trip-details-grid"><div className="coord-review-details">
      <CoordinatorCard title="Route and cargo"><div className="coord-card-body"><div className="coord-detail-grid"><div className="coord-route-stop"><MapPin size={18} aria-hidden="true" /><div><p className="coord-field-label">Pickup</p><p>{order.order.origin}</p><small>Scheduled {formatDate(trip.scheduledStart)}</small></div></div><div className="coord-route-stop destination"><MapPin size={18} aria-hidden="true" /><div><p className="coord-field-label">Destination</p><p>{order.order.destination}</p><small>{order.order.deliveryInstructions ?? 'Not recorded'}</small></div></div></div><dl className="coord-route-metrics"><div><dt>Cargo</dt><dd>{order.order.cargo}</dd></div><div><dt>Weight</dt><dd>{order.order.weightTonnes ? `${order.order.weightTonnes} t` : 'Not recorded'}</dd></div><div><dt>Distance</dt><dd>{order.order.distanceKm ? `${order.order.distanceKm} km` : 'Not recorded'}</dd></div><div><dt>Trip window</dt><dd>{formatDate(trip.scheduledStart)} – {formatDate(trip.scheduledEnd)}</dd></div></dl></div></CoordinatorCard>
      <CoordinatorCard title="Assignment" subtitle="Change the vehicle, driver or mechanic if something goes wrong on the trip"><div>{[{ title: vehicle.registration, subtitle: `Vehicle · ${vehicle.description}${vehicle.capacityTonnes ? ` · ${vehicle.capacityTonnes} t` : ''}`, icon: Truck }, { title: driver.user.name, subtitle: `Driver · ${driver.id}${driver.licence ? ` · ${driver.licence} licence` : ''}`, icon: UserRound }, { title: mechanic.user.name, subtitle: `Mechanic · ${mechanic.id}${mechanic.workshop ? ` · ${mechanic.workshop}` : ''}`, icon: Wrench }].map(({ title, subtitle, icon: Icon }) => <div className="coord-assignment-row" key={title}><span className="coord-avatar"><Icon size={18} aria-hidden="true" /></span><div><strong>{title}</strong><small>{subtitle}</small></div><Button className="coord-button secondary small" disabled title="Assignment changes are currently unavailable">Change</Button></div>)}</div><p className="coord-resource-footer"><Info size={14} aria-hidden="true" />Assignment changes are currently unavailable.{trip.resourcesHeld ? ' Resources remain reserved pending release.' : ''}</p></CoordinatorCard>
      <CoordinatorCard title="Trip activity">{data.activity.length ? data.activity.map((event) => <div className="coord-activity-row" key={event.id}><time>{formatDate(event.createdAt)}</time><p>{event.action.replace(/^Demo /, '')}</p></div>) : <p className="coord-card-body">No recorded trip activity.</p>}</CoordinatorCard>
    </div><div className="coord-review-details">
      <CoordinatorCard title="Order and customer"><dl className="coord-card-body coord-summary-list"><div><dt>Order</dt><dd><Link className="coord-mono" to={`/coordinator/orders/${trip.orderId}`}>{trip.orderId}</Link></dd></div><div><dt>Customer</dt><dd>{order.company.name}</dd></div><div><dt>Contact</dt><dd>{order.contact.name}{order.customer.mobile ? ` · ${order.customer.mobile}` : ''}</dd></div><div><dt>Payment</dt><dd><StatusBadge>{paymentStatus(order)}</StatusBadge></dd></div><div><dt>Quoted fare</dt><dd className="coord-mono">{latestQuote ? money(latestQuote.amount) : 'Not recorded'}</dd></div></dl></CoordinatorCard>
      <CoordinatorCard title="Odometer" subtitle="Recorded trip readings"><dl className="coord-card-body coord-summary-list"><div><dt>Start</dt><dd>{trip.startingOdometer !== undefined ? `${trip.startingOdometer.toLocaleString()} km` : 'Not recorded'}</dd></div><div><dt>End</dt><dd>{trip.status === 'Completed' ? `${trip.finalOdometer.toLocaleString()} km` : 'Not entered yet'}</dd></div><div><dt>Distance driven</dt><dd>{trip.status === 'Completed' && trip.startingOdometer !== undefined ? `${(trip.finalOdometer - trip.startingOdometer).toLocaleString()} km` : '—'}</dd></div>{trip.status === 'Completed' && <div><dt>Actual return</dt><dd>{formatDate(trip.actualReturnDate)}</dd></div>}</dl></CoordinatorCard>
      <CoordinatorCard title="Notes for this trip" action={<Button variant="ghost" disabled className="coord-link" title="Notes editing is currently unavailable">Edit</Button>}><p className="coord-card-body">{trip.notes ?? 'No notes recorded.'}</p></CoordinatorCard>
    </div></div>
    {dialog && <TripActionDialog trip={dialog.trip} kind={dialog.kind} onClose={close} onSaved={saved} />}
  </div>
}
