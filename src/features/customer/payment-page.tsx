import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { applicationServices } from '../../services/application-services'
import { paymentInputSchema, type CustomerQuotation, type PaymentInput } from '../../types/customer-billing'
import { ErrorState, LoadingState } from '../../components/ui/page-states'
import { useCoordinatorQuery } from '../coordinator/use-coordinator-query'
import { CustomerCard } from './customer-components'
import { BillingBreadcrumb, BillingFacts } from './billing-components'
import { customerDate, customerMoney } from './customer-format'
import card from '../../assets/customer-billing/card.svg'
import lock from '../../assets/customer-billing/lock.svg'
import './billing.css'

export function CustomerPaymentPage() {
  const { quotationId = '' } = useParams()
  const query = useCallback(() => applicationServices.getCustomerQuotation(quotationId), [quotationId])
  const { result, retry } = useCoordinatorQuery(query)
  if (!result) return <div className="coord-page"><LoadingState /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <PaymentForm key={quotationId} data={result.data} />
}
export function PaymentForm({ data }: { data: CustomerQuotation }) {
  const { quotation, details } = data
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [requestId] = useState(() => crypto.randomUUID())
  const form = useForm<PaymentInput>({ resolver: zodResolver(paymentInputSchema), defaultValues: { quotationId: quotation.id, requestId, method: 'Card' } })
  const paid = details.payments.find((payment) => payment.status === 'Succeeded')
  const pending = details.payments.find((payment) => payment.status === 'Pending')
  const eligible = quotation.status === 'Accepted' && !paid
  const submit = form.handleSubmit(async (values) => {
    setError('')
    try {
      const result = await applicationServices.payQuotation(values)
      if (!result.ok) setError(result.error)
      else if (result.data.status === 'Pending') setError('The payment is pending. Resume it to check the result.')
      else navigate(`/customer/payments/${result.data.id}/${result.data.status === 'Succeeded' ? 'success' : 'failed'}`, { replace: true })
    } catch { setError('Unable to process the payment. Please try again.') }
  })
  return <div className="coord-page"><BillingBreadcrumb to={`/customer/quotations/${quotation.id}`} current="Payment">Quotation {details.order.id}</BillingBreadcrumb><div className="coord-page-heading"><div><h1>Pay for {details.order.id}</h1><p>You accepted the fare quotation.</p></div></div>{error && <ErrorState message={error} />}
    {!eligible ? <CustomerCard title={paid ? 'Payment already recorded' : 'Payment unavailable'}><div className="coord-card-body"><p>{paid ? 'This order already has a successful payment record.' : 'Only accepted quotations can be paid.'}</p><Link className="coord-link" to={paid ? `/customer/payments/${paid.id}/success` : `/customer/quotations/${quotation.id}`}>{paid ? 'View payment' : 'Back to quotation'}</Link></div></CustomerCard> : <form noValidate onSubmit={submit} className="billing-grid payment"><CustomerCard title="Pay by debit or credit card" action={<span className="billing-card-brands">VISA  Mastercard  Amex</span>}><fieldset disabled={form.formState.isSubmitting} className="customer-form-body"><legend className="sr-only">Card payment</legend><div className="billing-card-title"><img src={card} alt="" /><span>Card</span></div>{[['Name on card', 'Not collected'], ['Card number', '•••• •••• •••• ••••']].map(([label, value]) => <label className="coord-form-field" key={label}><span>{label}</span><input className="coord-input" value={value} readOnly aria-readonly="true" autoComplete="off" tabIndex={-1} /></label>)}<div className="customer-form-grid">{[['Expiry date', 'MM / YY'], ['Security code (CVV)', '•••']].map(([label, value]) => <label className="coord-form-field" key={label}><span>{label}</span><input className="coord-input" value={value} readOnly autoComplete="off" tabIndex={-1} /></label>)}</div><p className="billing-security"><img src={lock} alt="" />Payment gateway unavailable. This action records a local payment outcome only; no funds are transferred. Do not enter card details.</p></fieldset></CustomerCard><aside className="customer-column"><CustomerCard title="Payment summary"><div className="coord-card-body"><BillingFacts rows={[
      ['Order', details.order.id], ['Route', `${details.order.origin} → ${details.order.destination}`], ['Pickup', customerDate(details.order.pickupAt)], ['Fare quotation', customerMoney(quotation.amount)],
    ]} /><div className="billing-charge total"><strong>Total to pay</strong><span className="coord-mono">{customerMoney(quotation.amount)}</span></div><label className="customer-confirm"><input type="checkbox" {...form.register('confirmed')} aria-invalid={!!form.formState.errors.confirmed} aria-describedby="payment-confirm-error" disabled={form.formState.isSubmitting} />Confirm {customerMoney(quotation.amount)}</label>{form.formState.errors.confirmed && <p id="payment-confirm-error" className="coord-field-error" role="alert">{form.formState.errors.confirmed.message}</p>}<button className="coord-button" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Processing…' : pending ? 'Resume payment' : `Pay ${customerMoney(quotation.amount)}`}</button><Link className="coord-link billing-back" to={`/customer/quotations/${quotation.id}`}>Back to quotation</Link></div></CustomerCard></aside></form>}
  </div>
}
