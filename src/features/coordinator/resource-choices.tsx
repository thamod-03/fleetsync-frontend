import type { ReactNode } from 'react'
import type { UseFormRegister } from 'react-hook-form'
import { CoordinatorCard, StatusBadge } from './coordinator-components'
import type { TripFormValues } from './trip-schema'

export interface ResourceChoice { id: string; title: string; subtitle: string; values: string[] }
export function ResourceChoices({ title, subtitle, columns, choices, field, selected, register, error, filter, footer }: {
  title: string; subtitle: string; columns: string[]; choices: ResourceChoice[]
  field: 'vehicleId' | 'driverId' | 'mechanicId'; selected: string; register: UseFormRegister<TripFormValues>
  error?: string; filter?: ReactNode; footer?: ReactNode
}) {
  return <fieldset className="coord-resource-fieldset"><legend className="sr-only">{title}</legend><CoordinatorCard title={title} subtitle={subtitle} action={filter}>
    <div className="coord-table-scroll"><table className="coord-resource-table"><thead><tr><th scope="col">{columns[0]}</th>{columns.slice(1).map((column) => <th key={column} scope="col">{column}</th>)}<th scope="col">Status</th></tr></thead><tbody>{choices.map((row) => <tr key={row.id} className={selected === row.id ? 'selected' : ''}><td><label><input type="radio" required value={row.id} {...register(`assignment.${field}`)} aria-invalid={!!error} aria-describedby={error ? `${field}-error` : undefined} /><span><strong>{row.title}</strong><small>{row.subtitle}</small></span></label></td>{row.values.map((value, index) => <td key={index}>{value}</td>)}<td><StatusBadge>Available</StatusBadge></td></tr>)}</tbody></table></div>
    {!choices.length && <p className="coord-card-body">No available resources match this filter.</p>}
    {error && <p className="coord-resource-error coord-field-error" id={`${field}-error`}>Select an available {field === 'vehicleId' ? 'vehicle' : field === 'driverId' ? 'driver' : 'mechanic'}.</p>}
    {footer && <div className="coord-resource-footer">{footer}</div>}
  </CoordinatorCard></fieldset>
}
