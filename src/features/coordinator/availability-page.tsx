import { useState } from 'react'
import { TrendingUp, Truck, Users, Wrench } from 'lucide-react'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/page-states'
import { applicationServices } from '../../services/application-services'
import type { ResourceAvailability } from '../../types/trip-assignment'
import type { Trip } from '../../types/domain'
import { CoordinatorCard, StatusBadge } from './coordinator-components'
import { useCoordinatorQuery } from './use-coordinator-query'

export function AvailabilityPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getAvailability)
  if (!result) return <div className="coord-page"><LoadingState label="Loading resource availability…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <Availability data={result.data} />
}

function ScheduleBar({ trip, date }: { trip: Trip; date: string }) {
  if (!trip.scheduledStart || !trip.scheduledEnd) return <span className="coord-schedule-booking" style={{ left: 0, width: '100%' }} title="Reserved; trip window not recorded">{trip.id}</span>
  const start = new Date(`${date}T06:00`).getTime()
  const end = new Date(`${date}T20:00`).getTime()
  const from = Math.max(start, Date.parse(trip.scheduledStart))
  const to = Math.min(end, Date.parse(trip.scheduledEnd))
  if (to <= from) return null
  return <span className="coord-schedule-booking" style={{ left: `${(from - start) / (end - start) * 100}%`, width: `${(to - from) / (end - start) * 100}%` }} title={`${trip.id}: ${new Date(trip.scheduledStart).toLocaleString()} – ${new Date(trip.scheduledEnd).toLocaleString()}`}>{trip.id}</span>
}

export function Availability({ data }: { data: ResourceAvailability }) {
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('14:00')
  const [capacity, setCapacity] = useState('')
  const [tab, setTab] = useState('All')
  const [allDrivers, setAllDrivers] = useState(false)
  const validWindow = !!date && !!start && !!end && Number.isFinite(Date.parse(`${date}T${start}`)) && start < end
  const stats = [
    { label: 'Vehicles free', value: data.vehicles.filter((item) => item.selectable).length, meta: `of ${data.vehicles.length} vehicles`, icon: Truck, tone: 'neutral' },
    { label: 'Drivers free', value: data.drivers.filter((item) => item.selectable).length, meta: `of ${data.drivers.length} drivers`, icon: Users, tone: 'success' },
    { label: 'Mechanics free', value: data.mechanics.filter((item) => item.selectable).length, meta: `of ${data.mechanics.length} mechanics`, icon: TrendingUp, tone: 'accent' },
    { label: 'In maintenance', value: data.vehicles.every((item) => item.inMaintenance !== undefined) ? data.vehicles.filter((item) => item.inMaintenance).length : '—', meta: 'vehicles booked for service', icon: Wrench, tone: 'pending' },
  ]
  const state = (vehicle: ResourceAvailability['vehicles'][number]) => vehicle.inMaintenance ? 'Maintenance' : vehicle.selectable ? 'Free' : 'Busy'
  const vehicles = data.vehicles.filter((vehicle) => (tab === 'All' || state(vehicle) === tab) && (!capacity || (vehicle.capacityTonnes !== undefined && vehicle.capacityTonnes >= Number(capacity))))
  const shadeStart = Math.max(0, Math.min(100, (Number(start.slice(0, 2)) + Number(start.slice(3)) / 60 - 6) / 14 * 100))
  const shadeEnd = Math.max(0, Math.min(100, (Number(end.slice(0, 2)) + Number(end.slice(3)) / 60 - 6) / 14 * 100))
  return <div className="coord-page">
    <div className="coord-page-heading"><div><h1>Availability</h1><p>Check which vehicles, drivers and mechanics are free for a day and time window before you create a trip.</p></div><div className="coord-window-filter"><input className="coord-input" type="date" aria-label="Availability date" value={date} onChange={(event) => setDate(event.target.value)} /><input className="coord-input" type="time" aria-label="Window start" value={start} onChange={(event) => setStart(event.target.value)} /><span>–</span><input className="coord-input" type="time" aria-label="Window end" value={end} onChange={(event) => setEnd(event.target.value)} /></div></div>
    {!validWindow && <ErrorState message="Choose a date and an end time after the start time." />}
    <div className="coord-kpis">{stats.map(({ label, value, meta, icon: Icon, tone }) => <section className="coord-kpi" key={label}><span className={`coord-icon coord-badge-${tone}`}><Icon size={20} aria-hidden="true" /></span><div><h2>{label}</h2><strong>{value}</strong><p>{meta}</p></div></section>)}</div>
    <div className="coord-availability-grid">
      <CoordinatorCard title="Vehicle schedule" subtitle="Booked trips and service for the day. The shaded band is your time window." action={<select className="coord-input" aria-label="Vehicle capacity" value={capacity} onChange={(event) => setCapacity(event.target.value)}><option value="">Capacity: any</option>{[...new Set(data.vehicles.flatMap((item) => item.capacityTonnes ? [item.capacityTonnes] : []))].sort((a,b) => a-b).map((value) => <option key={value} value={value}>Capacity ≥ {value} t</option>)}</select>}>
        <nav className="coord-schedule-tabs" aria-label="Vehicle availability">{['All', 'Free', 'Busy', 'Maintenance'].map((value) => <button key={value} className={tab === value ? 'active' : ''} aria-current={tab === value ? 'page' : undefined} onClick={() => setTab(value)}>{value}<span>{value === 'All' ? data.vehicles.length : data.vehicles.filter((item) => state(item) === value).length}</span></button>)}</nav>
        {!vehicles.length ? <EmptyState title="No matching vehicles" description="Try another status or capacity filter." /> : <div className="coord-table-scroll"><table className="coord-schedule-table"><caption className="sr-only">Vehicle availability schedule</caption><thead><tr><th scope="col">Vehicle</th><th scope="col"><span className="coord-schedule-hours">{['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'].map((hour) => <span key={hour} style={{ left: `${(Number(hour.slice(0, 2)) - 6) / 14 * 100}%` }}>{hour}</span>)}</span></th><th scope="col">In window</th></tr></thead><tbody>{vehicles.map((vehicle) => <tr key={vehicle.id}><td><span className="coord-mono">{vehicle.registration}</span><small>{vehicle.description}{vehicle.capacityTonnes ? ` · ${vehicle.capacityTonnes} t` : ''}</small></td><td><div className="coord-schedule-track">{validWindow && <span className="coord-schedule-window" style={{ left: `${shadeStart}%`, width: `${Math.max(0, shadeEnd - shadeStart)}%` }} />}{validWindow && vehicle.trips.map((trip) => <ScheduleBar key={trip.id} trip={trip} date={date} />)}{vehicle.inMaintenance && <span className="coord-schedule-service">Service</span>}</div></td><td><StatusBadge>{state(vehicle)}</StatusBadge></td></tr>)}</tbody></table></div>}
        <div className="coord-schedule-legend"><span>▢ Booked trip</span><span>▢ Service</span><span>▢ Your time window</span><span>Showing {vehicles.length} of {data.vehicles.length}</span></div><p className="coord-resource-footer">Active assignments keep resources reserved until released.</p>
      </CoordinatorCard>
      <div className="coord-review-details"><CoordinatorCard title="Drivers free" subtitle={`${data.drivers.filter((item) => item.selectable).length} drivers are available`}><div>{data.drivers.filter((item) => allDrivers || item.selectable).map((driver) => <div key={driver.id} className="coord-staff-row"><span className="coord-avatar">{driver.user.name.split(' ').map((part) => part[0]).join('')}</span><div><strong>{driver.user.name}</strong><small>{driver.licence ?? 'Licence not recorded'} · {driver.id}</small></div><span className={driver.selectable ? 'coord-free-text' : ''}>{driver.selectable ? 'Available' : 'Reserved'}</span></div>)}{!data.drivers.some((item) => item.selectable) && !allDrivers && <p className="coord-card-body">No drivers available.</p>}</div><button className="coord-link coord-staff-more" onClick={() => setAllDrivers((value) => !value)}>{allDrivers ? 'Show available drivers' : `View all ${data.drivers.length} drivers`}</button></CoordinatorCard>
      <CoordinatorCard title="Mechanics free" subtitle={`${data.mechanics.filter((item) => item.selectable).length} of ${data.mechanics.length} are available`}><div>{data.mechanics.map((mechanic) => <div key={mechanic.id} className="coord-staff-row"><span className="coord-avatar">{mechanic.user.name.split(' ').map((part) => part[0]).join('')}</span><div><strong>{mechanic.user.name}</strong><small>{mechanic.speciality ?? 'Not recorded'} · {mechanic.workshop ?? 'Not recorded'}</small></div><span className={mechanic.selectable ? 'coord-free-text' : ''}>{mechanic.selectable ? 'Available' : 'Reserved'}</span></div>)}</div></CoordinatorCard></div>
    </div>
  </div>
}
