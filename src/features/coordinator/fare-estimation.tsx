import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Info } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { ErrorState } from '../../components/ui/page-states'
import { applicationServices } from '../../services/application-services'
import type { FareQuotation } from '../../types/domain'
import type { OrderDetails } from '../../types/coordinator'
import { totalFare, type FareCharges } from '../../types/quotation'
import { CoordinatorCard } from './coordinator-components'
import { formatDate, money } from './coordinator-format'
import { localDateTime, quotationFormSchema, type QuotationFormInput, type QuotationFormValues } from './quotation-schema'

const chargeFields: { key: keyof FareCharges; label: string }[] = [
  { key: 'distance', label: 'Distance charge' }, { key: 'load', label: 'Load charge' },
  { key: 'loading', label: 'Loading and unloading' }, { key: 'handling', label: 'Fragile handling' }, { key: 'tolls', label: 'Tolls and fees' },
]
export function FareEstimation({ details, onSaved }: { details: OrderDetails; onSaved: (quotation: FareQuotation, publish: boolean, emailDelivered: boolean) => void }) {
  const draft = details.quotations.find((item) => item.status === 'Draft')
  const issued = details.quotations.find((item) => item.status !== 'Draft')
  return <CoordinatorCard title="Fare estimation" subtitle="Sent to the customer as a quotation by email">
    {issued ? <div className="coord-card-body coord-fare-summary">
      <dl className="coord-detail-grid"><div><dt>Vehicle type needed</dt><dd>{issued.vehicleType ?? 'Not recorded'}</dd></div><div><dt>Status</dt><dd>{issued.status === 'Pending' ? 'Awaiting customer decision' : issued.status}</dd></div></dl>
      {issued.charges ? <div className="coord-charge-list">{chargeFields.map(({ key, label }) => <div className="coord-charge-row" key={key}><span>{label}</span><span className="coord-mono">{money(issued.charges![key])}</span></div>)}</div> : <p>Fare breakdown not recorded.</p>}
      <div className="coord-fare-total"><strong>Total quotation</strong><span className="coord-mono">{money(issued.amount)}</span></div>
      <dl className="coord-detail-grid"><div><dt>Valid until</dt><dd>{formatDate(issued.validUntil)}</dd></div><div><dt>Payment</dt><dd>Online, before pickup</dd></div></dl>
      {issued.message && <div><p className="coord-field-label">Message to customer</p><p>{issued.message}</p></div>}
      <p className="coord-helper"><Info size={14} aria-hidden="true" />The customer can accept or decline it from their account.</p>
    </div> : <QuotationForm details={details} draft={draft} onSaved={onSaved} />}
  </CoordinatorCard>
}

function QuotationForm({ details, draft, onSaved }: { details: OrderDetails; draft?: FareQuotation; onSaved: (quotation: FareQuotation, publish: boolean, emailDelivered: boolean) => void }) {
  const [draftId, setDraftId] = useState(draft?.id)
  const [error, setError] = useState('')
  const [operation, setOperation] = useState<'draft' | 'publish' | null>(null)
  const form = useForm<QuotationFormInput, unknown, QuotationFormValues>({ resolver: zodResolver(quotationFormSchema), defaultValues: {
    vehicleType: draft?.vehicleType ?? '', charges: draft?.charges ?? { distance: 0, load: 0, loading: 0, handling: 0, tolls: 0 },
    validUntil: localDateTime(draft?.validUntil), message: draft?.message ?? '',
  } })
  const charges = useWatch({ control: form.control, name: 'charges' })
  const amount = totalFare({ distance: Number(charges.distance) || 0, load: Number(charges.load) || 0, loading: Number(charges.loading) || 0, handling: Number(charges.handling) || 0, tolls: Number(charges.tolls) || 0 })
  const submit = (publish: boolean) => form.handleSubmit(async (values) => {
    if (publish && Date.parse(values.validUntil) <= Date.now()) {
      form.setError('validUntil', { message: 'Choose a quotation validity time in the future.' }, { shouldFocus: true })
      return
    }
    setError(''); setOperation(publish ? 'publish' : 'draft')
    try {
      const result = await applicationServices.saveQuotation({ ...values, orderId: details.order.id, draftId }, publish)
      if (!result.ok) { setError(result.error); return }
      setDraftId(result.data.quotation.id)
      onSaved(result.data.quotation, publish, result.data.emailDelivered)
    } catch { setError('Unable to save the quotation. Please try again.') }
    finally { setOperation(null) }
  })
  const errors = form.formState.errors
  return <form className="coord-fare-form" noValidate onSubmit={submit(true)}>
    {error && <ErrorState message={error} />}
    <fieldset disabled={operation !== null}>
      <label className="coord-form-field"><span>Vehicle type needed</span><select className="coord-input" {...form.register('vehicleType')} aria-invalid={!!errors.vehicleType} aria-describedby={errors.vehicleType ? 'vehicle-error' : undefined}><option value="">Select vehicle type</option>{details.vehicleTypes.map((type) => <option key={type}>{type}</option>)}</select>{errors.vehicleType && <span className="coord-field-error" id="vehicle-error">{errors.vehicleType.message}</span>}</label>
      <div className="coord-charge-list">{chargeFields.map(({ key, label }) => {
        const detail = key === 'distance' ? (details.order.distanceKm ? `${details.order.distanceKm} km` : 'Distance not provided') : key === 'load' ? (details.order.weightTonnes ? `${details.order.weightTonnes} t` : 'Weight not provided') : key === 'loading' ? details.order.pallets : key === 'handling' ? details.order.handling : undefined
        const message = errors.charges?.[key]?.message
        return <div key={key} className="coord-charge-field"><div className="coord-charge-row"><label htmlFor={`charge-${key}`}>{label}{detail && <small>{detail}</small>}</label><div className="coord-money-input"><span aria-hidden="true">LKR</span><input id={`charge-${key}`} type="number" min="0" step="0.01" {...form.register(`charges.${key}`, { valueAsNumber: true })} aria-invalid={!!message} aria-describedby={message ? `error-${key}` : undefined} /></div></div>{message && <p id={`error-${key}`} className="coord-field-error">Enter a nonnegative amount up to LKR 1,000,000,000.</p>}</div>
      })}<div className="coord-fare-total"><strong>Total quotation</strong><output className="coord-mono" aria-live="polite">{money(amount)}</output></div></div>
      <div className="coord-detail-grid"><label className="coord-form-field"><span>Valid until</span><input className="coord-input" type="datetime-local" {...form.register('validUntil')} aria-invalid={!!errors.validUntil} aria-describedby={errors.validUntil ? 'expiry-error' : undefined} />{errors.validUntil && <span id="expiry-error" className="coord-field-error">{errors.validUntil.message}</span>}</label><div><p className="coord-field-label">Payment</p><p>Online, before pickup</p></div></div>
      <label className="coord-form-field"><span>Message to customer (optional)</span><textarea className="coord-input" rows={2} {...form.register('message')} aria-invalid={!!errors.message} aria-describedby={errors.message ? 'message-error' : undefined} />{errors.message && <span id="message-error" className="coord-field-error">{errors.message.message}</span>}</label>
      <div className="coord-actions coord-form-actions"><Button type="button" className="coord-button secondary" onClick={() => void submit(false)()}>{operation === 'draft' ? 'Saving…' : 'Save draft'}</Button><Button className="coord-button" type="submit">{operation === 'publish' ? 'Saving…' : 'Send quotation'}</Button></div>
    </fieldset>
    <p className="coord-helper"><Info size={14} aria-hidden="true" />The customer can accept or decline it from their account.</p>
  </form>
}
