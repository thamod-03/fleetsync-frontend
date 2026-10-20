import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { AlertTriangle, Check } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '../../components/ui/button'
import { ErrorState } from '../../components/ui/page-states'
import { applicationServices } from '../../services/application-services'
import type { Trip } from '../../types/domain'
import { cancelTripSchema, completeTripSchema } from '../../types/trip-management'
import { cancellableTripStatuses } from '../../types/trip-policy'

const completionFormSchema = completeTripSchema.extend({ actualReturnDate: z.string().min(1, 'Enter the actual return date and time.').refine((value) => Number.isFinite(Date.parse(value)), 'Enter a valid date and time.').transform((value) => new Date(value).toISOString()) })
const reasons = ['Vehicle breakdown', 'Customer cancelled the order', 'Driver unavailable', 'Cargo not ready at pickup', 'Other']

export function TripActionDialog({ trip, kind, onClose, onSaved }: { trip: Trip; kind: 'cancel' | 'complete'; onClose: () => void; onSaved: (trip: Trip) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cancellation = useForm<z.input<typeof cancelTripSchema>, unknown, z.output<typeof cancelTripSchema>>({ resolver: zodResolver(cancelTripSchema), defaultValues: { tripId: trip.id, expectedStatus: trip.status, reason: '', details: '' } })
  const completion = useForm<z.input<typeof completionFormSchema>, unknown, z.output<typeof completionFormSchema>>({ resolver: zodResolver(completionFormSchema), defaultValues: { tripId: trip.id, expectedStatus: trip.status, actualReturnDate: '' } })
  const save = async (operation: () => ReturnType<typeof applicationServices.cancelTrip>) => {
    setBusy(true); setError('')
    try { const result = await operation(); if (!result.ok) { setError(result.error); return }; onSaved(result.data) }
    catch { setError('Unable to save the trip. Please try again.') }
    finally { setBusy(false) }
  }
  const submit = kind === 'cancel' ? cancellation.handleSubmit((values) => save(() => applicationServices.cancelTrip(values))) : completion.handleSubmit((values) => {
    if (trip.startingOdometer !== undefined && values.finalOdometer < trip.startingOdometer) { completion.setError('finalOdometer', { message: 'The final odometer cannot be lower than the starting odometer.' }, { shouldFocus: true }); return }
    return save(() => applicationServices.completeTrip(values))
  })
  return <Dialog.Root open onOpenChange={(open) => { if (!open && !busy) onClose() }}><Dialog.Portal><Dialog.Backdrop className="coord-dialog-backdrop" /><Dialog.Popup className="coord-lifecycle-dialog coordinator-shell">
    <form noValidate onSubmit={submit}>
      <div className="coord-dialog-heading"><span className={`coord-icon coord-badge-${kind === 'cancel' ? 'danger' : 'success'}`}>{kind === 'cancel' ? <AlertTriangle size={20} aria-hidden="true" /> : <Check size={20} aria-hidden="true" />}</span><div><Dialog.Title>{kind === 'cancel' ? 'Cancel' : 'Complete'} trip {trip.id}?</Dialog.Title><Dialog.Description>{kind === 'cancel' ? `This trip is ${trip.status}. Cancellation cannot be undone. Resources remain reserved until their release is approved.` : 'Record the actual return time and final odometer. Completion cannot be undone. Resource reservations remain unchanged.'}</Dialog.Description></div></div>
      <div className="coord-dialog-body">
        {error && <ErrorState message={error} />}
        <fieldset disabled={busy} className="coord-dialog-fields">
          {kind === 'cancel' ? <><fieldset className="coord-cancel-reasons"><legend>Reason for cancelling <span aria-hidden="true">*</span></legend><div>{reasons.map((reason) => <label key={reason}><input type="radio" required value={reason} {...cancellation.register('reason')} aria-invalid={!!cancellation.formState.errors.reason} aria-describedby={cancellation.formState.errors.reason ? 'cancel-reason-error' : undefined} />{reason}</label>)}</div>{cancellation.formState.errors.reason && <p className="coord-field-error" id="cancel-reason-error">Select a cancellation reason.</p>}</fieldset><label className="coord-form-field"><span>Details</span><textarea className="coord-input" rows={3} {...cancellation.register('details')} maxLength={2000} aria-invalid={!!cancellation.formState.errors.details} aria-describedby={cancellation.formState.errors.details ? 'cancel-details-error' : undefined} />{cancellation.formState.errors.details && <span className="coord-field-error" id="cancel-details-error">Use at most 2,000 characters.</span>}</label><p className="coord-helper">{cancellableTripStatuses.join(', ')} trips can be cancelled. The reason is saved in the trip history and audit log.</p></> : <><p className="coord-helper">Starting odometer: {trip.startingOdometer?.toLocaleString() ?? 'Not recorded'} km</p><label className="coord-form-field"><span>Actual return date and time</span><input required className="coord-input" type="datetime-local" {...completion.register('actualReturnDate')} aria-invalid={!!completion.formState.errors.actualReturnDate} aria-describedby={completion.formState.errors.actualReturnDate ? 'return-error' : undefined} />{completion.formState.errors.actualReturnDate && <span className="coord-field-error" id="return-error">{completion.formState.errors.actualReturnDate.message}</span>}</label><label className="coord-form-field"><span>Final odometer (km)</span><input required className="coord-input" type="number" min={trip.startingOdometer ?? 0} step="any" {...completion.register('finalOdometer', { valueAsNumber: true })} aria-invalid={!!completion.formState.errors.finalOdometer} aria-describedby={completion.formState.errors.finalOdometer ? 'odometer-error' : undefined} />{completion.formState.errors.finalOdometer && <span className="coord-field-error" id="odometer-error">{completion.formState.errors.finalOdometer.message}</span>}</label></>}
        </fieldset>
      </div>
      <div className="coord-dialog-footer"><Button type="button" variant="ghost" className="coord-link" disabled={busy} onClick={onClose}>{kind === 'cancel' ? 'Keep trip' : 'Back'}</Button><Button type="submit" disabled={busy} className={`coord-button ${kind === 'cancel' ? 'danger' : ''}`}>{busy ? 'Saving…' : kind === 'cancel' ? 'Cancel trip' : 'Mark completed'}</Button></div>
    </form>
  </Dialog.Popup></Dialog.Portal></Dialog.Root>
}
