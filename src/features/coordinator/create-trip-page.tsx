import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Bell, Check, ChevronLeft, Info } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { ErrorState, LoadingState, EmptyState } from '../../components/ui/page-states'
import { applicationServices } from '../../services/application-services'
import type { TripAssignmentContext } from '../../types/trip-assignment'
import { CoordinatorCard, StatusBadge } from './coordinator-components'
import { formatDate, paymentStatus } from './coordinator-format'
import { localDateTime } from './quotation-schema'
import { ResourceChoices } from './resource-choices'
import { tripFormSchema, type TripFormValues, type TripFormResult } from './trip-schema'
import { useCoordinatorQuery } from './use-coordinator-query'

export function CreateTripPage() {
  const [params] = useSearchParams()
  const { result, retry } = useCoordinatorQuery(applicationServices.getTripAssignmentContext)
  if (!result) return <div className="coord-page"><LoadingState label="Loading trip assignment…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <CreateTrip data={result.data} key={params.get('orderId') ?? 'new'} />
}

export function CreateTrip({ data }: { data: TripAssignmentContext }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const initialOrder = data.orders.find((item) => item.order.id === params.get('orderId'))
  const [capacity, setCapacity] = useState('')
  const [licence, setLicence] = useState('')
  const [workshop, setWorkshop] = useState('')
  const [error, setError] = useState('')
  const form = useForm<TripFormValues, unknown, TripFormResult>({ resolver: zodResolver(tripFormSchema), defaultValues: {
    orderId: initialOrder?.order.id ?? '', assignment: { vehicleId: '', driverId: '', mechanicId: '' },
    scheduledStart: localDateTime(initialOrder?.order.pickupAt), scheduledEnd: localDateTime(initialOrder?.order.estimatedReturnAt),
  } })
  const values = useWatch({ control: form.control })
  const details = data.orders.find((item) => item.order.id === values.orderId)
  const vehicle = data.vehicles.find((item) => item.id === values.assignment?.vehicleId)
  const driver = data.drivers.find((item) => item.id === values.assignment?.driverId)
  const mechanic = data.mechanics.find((item) => item.id === values.assignment?.mechanicId)
  const vehicles = data.vehicles.filter((item) => item.selectable && (!capacity || (item.capacityTonnes !== undefined && item.capacityTonnes >= Number(capacity))))
  const drivers = data.drivers.filter((item) => item.selectable && (!licence || item.licence === licence))
  const mechanics = data.mechanics.filter((item) => item.selectable && (!workshop || item.workshop === workshop))
  const errors = form.formState.errors
  const allFree = !!(vehicle?.selectable && driver?.selectable && mechanic?.selectable)
  const submit = form.handleSubmit(async (input) => {
    setError('')
    try {
      const result = await applicationServices.createTrip(input)
      if (!result.ok) { setError(result.error); return }
      navigate(`/coordinator/trips/${result.data.id}/assigned`, { replace: true })
    } catch { setError('Unable to create the trip. Please try again.') }
  })
  return <div className="coord-page">
    <nav className="coord-breadcrumb" aria-label="Breadcrumb"><Link to="/coordinator/orders"><ChevronLeft size={14} aria-hidden="true" />Submitted orders</Link>{details && <><span>/</span><Link to={`/coordinator/orders/${details.order.id}`}>{details.order.id}</Link></>}<span>/</span><span>Create trip</span></nav>
    <div className="coord-page-heading"><div><h1>Create trip</h1><p>Pick an available vehicle, driver and mechanic for this order. Only those free for the whole trip window are shown.</p></div></div>
    {!data.orders.length ? <EmptyState title="No orders available for assignment" description="Orders with an active trip already have an assignment." action={<Link className="coord-link" to="/coordinator/orders">Back to orders</Link>} /> : <form className="coord-trip-form" noValidate onSubmit={submit}>
      {error && <ErrorState message={error} />}
      <fieldset disabled={form.formState.isSubmitting} className="coord-trip-form-fields">
        <div className="coord-trip-window"><label className="coord-form-field"><span>Customer order</span><select required className="coord-input" {...form.register('orderId', { onChange: (event) => { const selected = data.orders.find((item) => item.order.id === event.target.value); form.setValue('scheduledStart', localDateTime(selected?.order.pickupAt)); form.setValue('scheduledEnd', localDateTime(selected?.order.estimatedReturnAt)); form.setValue('assignment', { vehicleId: '', driverId: '', mechanicId: '' }) } })} aria-invalid={!!errors.orderId} aria-describedby={errors.orderId ? 'order-error' : undefined}><option value="">Select customer order</option>{data.orders.map((item) => <option key={item.order.id} value={item.order.id}>{item.order.id} · {item.company.name}</option>)}</select>{errors.orderId && <span className="coord-field-error" id="order-error">{errors.orderId.message}</span>}</label><label className="coord-form-field"><span>Trip start</span><input type="datetime-local" required className="coord-input" {...form.register('scheduledStart')} aria-invalid={!!errors.scheduledStart} aria-describedby={errors.scheduledStart ? 'start-error' : undefined} />{errors.scheduledStart && <span className="coord-field-error" id="start-error">{errors.scheduledStart.message}</span>}</label><label className="coord-form-field"><span>Expected return</span><input type="datetime-local" required className="coord-input" {...form.register('scheduledEnd')} aria-invalid={!!errors.scheduledEnd} aria-describedby={errors.scheduledEnd ? 'end-error' : undefined} />{errors.scheduledEnd && <span className="coord-field-error" id="end-error">{errors.scheduledEnd.message}</span>}</label></div>
        <dl className="coord-order-strip"><div><dt>Order</dt><dd className="coord-mono">{details?.order.id ?? 'Select an order'}</dd></div><div><dt>Customer</dt><dd>{details?.company.name ?? '—'}</dd></div><div><dt>Route</dt><dd>{details ? `${details.order.origin} → ${details.order.destination}` : '—'}</dd></div><div><dt>Trip window</dt><dd>{values.scheduledStart && values.scheduledEnd ? `${formatDate(values.scheduledStart)} – ${formatDate(values.scheduledEnd)}` : 'Choose trip window'}</dd></div><div><dt>Cargo</dt><dd>{details?.order.cargo ?? '—'}</dd></div><div><dt>Payment</dt><dd>{details ? <StatusBadge>{paymentStatus(details)}</StatusBadge> : '—'}</dd></div></dl>
        <div className="coord-assignment-grid"><div className="coord-review-details">
          <ResourceChoices title="1. Choose a vehicle" subtitle={`${vehicles.length} of ${data.vehicles.length} vehicles are available`} columns={['Vehicle', 'Capacity', 'Home base', 'Next service']} choices={vehicles.map((item) => ({ id: item.id, title: item.registration, subtitle: item.description, values: [item.capacityTonnes ? `${item.capacityTonnes} t` : 'Not recorded', item.homeBase ?? 'Not recorded', item.nextServiceKm !== undefined ? `in ${item.nextServiceKm.toLocaleString()} km` : 'Not recorded'] }))} field="vehicleId" selected={values.assignment?.vehicleId ?? ''} register={form.register} error={errors.assignment?.vehicleId?.message} filter={<select className="coord-input" aria-label="Capacity filter" value={capacity} onChange={(event) => { setCapacity(event.target.value); form.setValue('assignment.vehicleId', '') }}><option value="">Capacity: any</option>{[...new Set(data.vehicles.flatMap((item) => item.capacityTonnes ? [item.capacityTonnes] : []))].sort((a,b) => a-b).map((value) => <option key={value} value={value}>Capacity ≥ {value} t</option>)}</select>} footer={<><Info size={14} aria-hidden="true" />Vehicles on another trip or in maintenance during this window are hidden.</>} />
          <ResourceChoices title="2. Choose a driver" subtitle={`${drivers.length} drivers are available`} columns={['Driver', 'Licence', 'Last trip ended', 'Trips this week']} choices={drivers.map((item) => ({ id: item.id, title: item.user.name, subtitle: item.id, values: [item.licence ?? 'Not recorded', 'Not recorded', 'Not recorded'] }))} field="driverId" selected={values.assignment?.driverId ?? ''} register={form.register} error={errors.assignment?.driverId?.message} filter={<select className="coord-input" aria-label="Licence filter" value={licence} onChange={(event) => { setLicence(event.target.value); form.setValue('assignment.driverId', '') }}><option value="">Licence: any</option>{[...new Set(data.drivers.flatMap((item) => item.licence ? [item.licence] : []))].map((value) => <option key={value}>{value}</option>)}</select>} />
          <ResourceChoices title="3. Choose a mechanic" subtitle="Covers breakdowns and repairs on this route during the trip" columns={['Mechanic', 'Speciality', 'Workshop', 'Open jobs']} choices={mechanics.map((item) => ({ id: item.id, title: item.user.name, subtitle: item.id, values: [item.speciality ?? 'Not recorded', item.workshop ?? 'Not recorded', 'Not recorded'] }))} field="mechanicId" selected={values.assignment?.mechanicId ?? ''} register={form.register} error={errors.assignment?.mechanicId?.message} filter={<select className="coord-input" aria-label="Workshop filter" value={workshop} onChange={(event) => { setWorkshop(event.target.value); form.setValue('assignment.mechanicId', '') }}><option value="">Base: any</option>{[...new Set(data.mechanics.flatMap((item) => item.workshop ? [item.workshop] : []))].map((value) => <option key={value}>{value}</option>)}</select>} />
        </div><CoordinatorCard title="Trip summary" subtitle="Check before creating the trip"><div className="coord-card-body">
          <dl className="coord-summary-list"><div><dt>Trip ID</dt><dd>Assigned on creation</dd></div><div><dt>Order</dt><dd>{details?.order.id ?? 'Not selected'}</dd></div><div><dt>Vehicle</dt><dd>{vehicle?.registration ?? 'Not selected'}</dd></div><div><dt>Driver</dt><dd>{driver?.user.name ?? 'Not selected'}</dd></div><div><dt>Mechanic</dt><dd>{mechanic?.user.name ?? 'Not selected'}</dd></div><div><dt>Trip window</dt><dd>{values.scheduledStart && values.scheduledEnd ? `${formatDate(values.scheduledStart)} – ${formatDate(values.scheduledEnd)}` : 'Not selected'}</dd></div><div><dt>Distance</dt><dd>{details?.order.distanceKm ? `${details.order.distanceKm} km` : 'Not recorded'}</dd></div></dl>
          <ul className="coord-assignment-checks"><li><Info size={14} aria-hidden="true" />{vehicle?.capacityTonnes !== undefined && details?.order.weightTonnes !== undefined ? `Vehicle capacity ${vehicle.capacityTonnes} t · cargo ${details.order.weightTonnes} t` : 'Vehicle capacity not confirmed'}</li><li>{allFree ? <Check size={14} aria-hidden="true" /> : <Info size={14} aria-hidden="true" />}{allFree ? 'Vehicle, driver and mechanic are available' : 'Select all three available resources'}</li><li>{details && paymentStatus(details) === 'Paid' ? <Check size={14} aria-hidden="true" /> : <Info size={14} aria-hidden="true" />}{details && paymentStatus(details) === 'Paid' ? 'Payment received' : 'Payment not recorded as paid'}</li></ul>
          <p className="coord-assignment-notice"><Bell size={16} aria-hidden="true" />Assignment notifications will be queued for the driver and mechanic.</p><Button className="coord-button" type="submit">{form.formState.isSubmitting ? 'Creating trip…' : 'Assign & create trip'}</Button><Link className="coord-link" to="/coordinator/orders">Cancel</Link>
        </div></CoordinatorCard></div>
      </fieldset>
    </form>}
  </div>
}
