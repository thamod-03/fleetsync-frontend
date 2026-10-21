import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Check, Info } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { applicationServices } from '../../services/application-services'
import { ErrorState, LoadingState } from '../../components/ui/page-states'
import { newOrderSchema, orderCargoSchema, orderRouteSchema, type CustomerWorkspace, type NewOrderValues } from '../../types/customer'
import { useCoordinatorQuery } from '../coordinator/use-coordinator-query'
import { CargoFields, OrderReview, OrderSidebar, RouteFields } from './order-form-fields'
import { wizardDefaults } from './customer-format'
import './customer.css'

const routeFields = Object.keys(orderRouteSchema.shape) as (keyof NewOrderValues)[]
const cargoFields = Object.keys(orderCargoSchema.shape) as (keyof NewOrderValues)[]
const steps = ['Pickup and destination', 'Cargo details', 'Review and submit']
export function NewCustomerOrderPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getCustomerWorkspace)
  if (!result) return <div className="coord-page"><LoadingState label="Loading order form…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <NewCustomerOrder data={result.data} key={result.data.user.id} />
}
export function NewCustomerOrder({ data }: { data: CustomerWorkspace }) {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [requestId] = useState(() => crypto.randomUUID())
  const [error, setError] = useState('')
  const form = useForm<NewOrderValues>({ resolver: zodResolver(newOrderSchema), shouldUnregister: false, defaultValues: { ...wizardDefaults, pickupContactName: data.user.name, pickupContactPhone: data.customer.mobile ?? '' } })
  useWatch({ control: form.control })
  const values = form.getValues()
  const busy = form.formState.isSubmitting
  const next = () => {
    const fields = step === 1 ? routeFields : cargoFields
    form.clearErrors(fields)
    const result = (step === 1 ? orderRouteSchema : orderCargoSchema).safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues) { const field = issue.path[0] as keyof NewOrderValues; form.setError(field, { message: issue.message }) }
      const first = result.error.issues[0]?.path[0] as keyof NewOrderValues | undefined
      if (first) form.setFocus(first)
      return
    }
    setStep(step === 1 ? 2 : 3)
  }
  const submit = form.handleSubmit(async (input) => {
    setError('')
    try {
      const result = await applicationServices.createCustomerOrder({ ...input, requestId })
      if (!result.ok) { setError(result.error); return }
      navigate(`/customer/orders/${result.data.id}`, { replace: true, state: { orderSubmitted: true } })
    } catch { setError('Unable to submit the order. Your form values are still available. Please try again.') }
  }, (errors) => { if (routeFields.some((field) => errors[field])) setStep(1); else if (cargoFields.some((field) => errors[field])) setStep(2) })
  return <div className="coord-page"><div className="coord-page-heading"><div><h1>New transport order</h1><p>{step === 1 ? 'Tell us where to pick up and deliver. A coordinator reviews your order and sends you a fare quotation.' : step === 2 ? 'Describe what we are moving so the coordinator can pick the right vehicle and price it.' : 'Check your order before you submit it. You can go back and change anything.'}</p></div></div>
    <ol className="customer-wizard-steps" aria-label="Order progress">{steps.map((label, index) => <li key={label} className={index + 1 === step ? 'current' : index + 1 < step ? 'complete' : ''} aria-current={index + 1 === step ? 'step' : undefined}><span>{index + 1 < step ? <Check size={15} aria-hidden="true" /> : index + 1}</span><div><small>Step {index + 1} of 3</small><strong>{label}</strong></div></li>)}</ol>
    {error && <ErrorState message={error} />}
    <form noValidate onSubmit={(event) => { if (step !== 3) { event.preventDefault(); next() } else void submit(event) }} aria-busy={busy}>
      <fieldset disabled={busy} className="customer-wizard-grid"><div className="customer-column">{step === 1 ? <RouteFields form={form} data={data} /> : step === 2 ? <CargoFields form={form} /> : <><OrderReview values={values} edit={setStep} /><p className="customer-payment-info"><Info size={16} aria-hidden="true" />Nothing to pay now. After a coordinator reviews your order you get a fare quotation, and you pay only if you accept it.</p><label className="customer-confirm"><input type="checkbox" {...form.register('confirmed')} aria-invalid={!!form.formState.errors.confirmed} aria-describedby="order-confirm-error" />I confirm these details are correct.</label>{form.formState.errors.confirmed && <p className="coord-field-error" role="alert" id="order-confirm-error">{form.formState.errors.confirmed.message}</p>}</>}
        <div className="customer-wizard-footer">{step === 1 ? <Link className="coord-link" to="/customer/orders">Cancel</Link> : <button type="button" className="coord-button secondary" onClick={() => setStep(step === 3 ? 2 : 1)}>Back</button>}{step === 3 ? <button type="submit" className="coord-button" disabled={busy}>{busy ? 'Submitting…' : 'Submit order'}</button> : <button type="button" className="coord-button" onClick={next}>Next: {step === 1 ? 'cargo details' : 'review order'}</button>}</div>
      </div><OrderSidebar values={values} review={step === 3} /></fieldset>
    </form>
  </div>
}
