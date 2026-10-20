import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Check, ChevronLeft, Info } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { ErrorState, LoadingState } from '../../components/ui/page-states'
import { applicationServices } from '../../services/application-services'
import type { TripAssignmentDetails } from '../../types/trip-assignment'
import { CoordinatorCard, StatusBadge } from './coordinator-components'
import { formatDate } from './coordinator-format'
import { useCoordinatorQuery } from './use-coordinator-query'
import logo from '../../assets/auth/logo.svg'

export function TripAssignedPage() {
  const { tripId = '' } = useParams()
  const query = useCallback(() => applicationServices.getAssignedTrip(tripId), [tripId])
  const { result, retry } = useCoordinatorQuery(query)
  if (!result) return <div className="coord-page"><LoadingState label="Loading trip assignment…" /></div>
  if (!result.ok) return <div className="coord-page"><Link className="coord-link" to="/coordinator/orders">Back to orders</Link><ErrorState message={result.error} onRetry={retry} /></div>
  return <TripAssigned data={result.data} />
}

export function TripAssigned({ data }: { data: TripAssignmentDetails }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const { trip, order, vehicle, driver, mechanic, creator } = data
  const requeue = async (userId: string) => {
    setBusy(true); setMessage('')
    try { const result = await applicationServices.requeueTripNotification(trip.id, userId); setMessage(result.ok ? result.data.message : result.error) }
    catch { setMessage('Unable to queue the notification. Please try again.') }
    finally { setBusy(false) }
  }
  const rows = [['Trip ID', trip.id], ['Order', trip.orderId], ['Customer', order.company.name], ['Route', `${order.order.origin} → ${order.order.destination}`], ['Trip window', trip.scheduledStart && trip.scheduledEnd ? `${formatDate(trip.scheduledStart)} – ${formatDate(trip.scheduledEnd)}` : 'Not recorded'], ['Cargo', order.order.cargo], ['Vehicle', vehicle.registration], ['Driver', driver.user.name], ['Mechanic', mechanic.user.name], ['Created by', creator ? `${creator.name} · ${formatDate(trip.createdAt)}` : 'Not recorded']]
  return <div className="coord-page">
    <nav className="coord-breadcrumb" aria-label="Breadcrumb"><ChevronLeft size={14} aria-hidden="true" /><span>Trips</span><span>/</span><span className="coord-mono">{trip.id}</span></nav>
    <section className="coord-assignment-success" aria-labelledby="assignment-title"><span className="coord-success-icon"><Check size={26} aria-hidden="true" /></span><div><div className="coord-title-row"><h1 id="assignment-title">Trip {trip.id} created</h1><StatusBadge>{trip.status}</StatusBadge></div><p>{trip.orderId} for {order.company.name}{trip.scheduledStart ? ` is assigned for ${formatDate(trip.scheduledStart)}` : ' is assigned'}. Driver and mechanic notifications are queued locally. Push delivery is unavailable; no push notification was sent.</p></div><div className="coord-actions"><Link className="coord-button secondary" to="/coordinator/orders">Back to orders</Link><Button className="coord-button" disabled title="Currently unavailable">View trip</Button></div></section>
    {message && <p className="coord-confirmation" role="status">{message}</p>}
    <div className="coord-assignment-grid"><div className="coord-review-details">
      <CoordinatorCard title="Push notifications" subtitle="Assignment notifications queued when the trip was created"><div className="coord-table-scroll"><table className="coord-notification-table"><thead><tr><th scope="col">Recipient</th><th scope="col">Destination</th><th scope="col">Queued</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{[{ profile: driver, role: 'Driver', app: 'Driver app' }, { profile: mechanic, role: 'Mechanic', app: 'Mechanic app' }].map(({ profile, role, app }) => {
        const notice = data.notifications.filter((item) => item.userId === profile.userId).at(-1)
        return <tr key={profile.id}><td><span className="coord-recipient"><span className="coord-avatar">{profile.user.name.split(' ').map((part) => part[0]).join('')}</span><span>{profile.user.name}<small>{role} · {profile.id}</small></span></span></td><td>{app}</td><td>{notice ? formatDate(notice.createdAt) : 'Not recorded'}</td><td><StatusBadge>{notice?.deliveryState ?? 'Not recorded'}</StatusBadge></td><td><Button className="coord-button secondary small" disabled={busy || !['Draft', 'Assigned', 'In Progress'].includes(trip.status)} onClick={() => void requeue(profile.userId)}>Resend</Button></td></tr>
      })}</tbody></table></div><p className="coord-resource-footer"><Info size={14} aria-hidden="true" />Push delivery and opened status are unavailable.</p></CoordinatorCard>
      <CoordinatorCard title="What the driver sees" subtitle="Preview of the assignment notification"><div className="coord-notification-preview"><div className="coord-push-surface"><div className="coord-push-card"><span className="coord-logo"><img src={logo} alt="" /></span><div><p className="coord-field-label">FleetSync</p><strong>New trip assigned · {trip.id}</strong><p>{order.order.origin} → {order.order.destination} · {formatDate(trip.scheduledStart)} · Vehicle {vehicle.registration}.</p></div></div></div><ul className="coord-assignment-checks"><li><Check size={14} aria-hidden="true" />Includes pickup, destination and start time</li><li><Check size={14} aria-hidden="true" />Includes the assigned vehicle details</li><li><Check size={14} aria-hidden="true" />Mechanic receives the same assignment information</li></ul></div></CoordinatorCard>
    </div><CoordinatorCard title="Trip details"><dl className="coord-card-body coord-summary-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></CoordinatorCard></div>
  </div>
}
