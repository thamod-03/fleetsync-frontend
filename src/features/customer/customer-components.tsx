import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CoordinatorCard } from '../coordinator/coordinator-components'
import type { CustomerTripInfo } from '../../types/customer'
import { customerDate } from './customer-format'

export { CoordinatorCard as CustomerCard } from '../coordinator/coordinator-components'
export function CustomerStatus({ children }: { children: string }) {
  const tone = ['Completed', 'Paid'].includes(children) ? 'success' : ['Cancelled', 'Quote declined', 'Declined', 'Failed'].includes(children) ? 'danger' : ['Quoted', 'Assigned'].includes(children) ? 'accent' : ['In Progress', 'Trip in progress', 'Accepted'].includes(children) ? 'info' : ['Pending review', 'Submitted', 'Pending'].includes(children) ? 'pending' : 'neutral'
  return <span className={`coord-badge coord-badge-${tone}`}>{children}</span>
}
export function UnavailableAction({ children, className = 'coord-button secondary small' }: { children: ReactNode; className?: string }) {
  return <button className={className} disabled title="This feature is not available yet.">{children}</button>
}
export function TripSummary({ info, orderLink = true }: { info: CustomerTripInfo; orderLink?: boolean }) {
  const { trip, vehicle, driver, mechanic } = info
  return <><dl className="customer-trip-facts"><div><dt>Vehicle</dt><dd>{vehicle?.registration ?? 'Not recorded'}</dd></div><div><dt>Driver</dt><dd>{driver?.name ?? 'Not recorded'}</dd></div><div><dt>Mechanic</dt><dd>{mechanic?.name ?? 'Not recorded'}</dd></div><div><dt>Trip window</dt><dd>{trip.scheduledStart && trip.scheduledEnd ? `${customerDate(trip.scheduledStart)} – ${customerDate(trip.scheduledEnd)}` : 'Not recorded'}</dd></div></dl><ol className="customer-timeline">{[{ label: 'Assigned', value: trip.status === 'Draft' ? undefined : trip.createdAt }, { label: 'Started by the driver', value: trip.actualStartAt }, { label: trip.status === 'Cancelled' ? 'Cancelled' : 'Completed', value: trip.status === 'Completed' ? trip.actualReturnDate : trip.cancelledAt }].map((step) => <li key={step.label} className={step.value ? 'recorded' : ''}><strong>{step.label}</strong><small>{customerDate(step.value)}</small></li>)}</ol>{orderLink && <div className="coord-actions"><Link className="coord-button secondary small" to={`/customer/orders/${trip.orderId}`}>View order</Link><UnavailableAction>Open chat</UnavailableAction></div>}</>
}
export function NextSteps() {
  return <CoordinatorCard title="What happens next"><ol className="customer-next-steps"><li>A coordinator reviews your order.</li><li>You get a fare quotation by email and here.</li><li>Accept it and pay online. Your trip is then scheduled.</li></ol></CoordinatorCard>
}
