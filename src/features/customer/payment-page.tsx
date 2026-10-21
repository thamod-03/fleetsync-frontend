import { useCallback, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { applicationServices } from '../../services/application-services'
import { createCardFormSchema, matchTestCard, type CardFormFields, type CustomerQuotation, type TestPaymentCard } from '../../types/customer-billing'
import { ErrorState, LoadingState } from '../../components/ui/page-states'
import { useCoordinatorQuery } from '../coordinator/use-coordinator-query'
import { CustomerCard } from './customer-components'
import { BillingBreadcrumb, BillingFacts } from './billing-components'
import { customerDate, customerMoney } from './customer-format'
import lock from '../../assets/customer-billing/lock.svg'
import './billing.css'

export function CustomerPaymentPage() {
  const { quotationId = '' } = useParams()
  const query = useCallback(async () => {
    const [quotation, cards] = await Promise.all([applicationServices.getCustomerQuotation(quotationId), applicationServices.getPaymentTestCards()])
    if (!quotation.ok) return quotation
    if (!cards.ok) return cards
    return { ok: true as const, data: { quotation: quotation.data, cards: cards.data } }
  }, [quotationId])
  const { result, retry } = useCoordinatorQuery(query)
  if (!result) return <div className="coord-page"><LoadingState /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <PaymentForm key={quotationId} data={result.data.quotation} cards={result.data.cards} />
}
export function PaymentForm({ data, cards = [] }: { data: CustomerQuotation; cards?: TestPaymentCard[] }) {
  const { quotation, details } = data
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [requestId] = useState(() => crypto.randomUUID())
  const form = useForm<CardFormFields>({ resolver: zodResolver(createCardFormSchema(cards)), defaultValues: { nameOnCard: '', cardNumber: '', expiry: '', securityCode: '' } })
  const paid = details.payments.find((payment) => payment.status === 'Succeeded')
  const pending = details.payments.find((payment) => payment.status === 'Pending')
  const eligible = quotation.status === 'Accepted' && !paid
  const submit = form.handleSubmit(async (values) => {
    setError('')
    const instrument = matchTestCard(cards, values)
    if (!instrument) { setError('Use one of the fictional test cards provided below.'); return }
    try {
      // Only the instrument token crosses the boundary; card fields stay in memory.
      const result = await applicationServices.payQuotation({ quotationId: quotation.id, requestId, method: 'Card', confirmed: true, instrumentId: instrument.id })
      if (!result.ok) setError(result.error)
      else if (result.data.status === 'Pending') setError('The payment is pending. Resume it to check the result.')
      else navigate(`/customer/payments/${result.data.id}/${result.data.status === 'Succeeded' ? 'success' : 'failed'}`, { replace: true })
    } catch { setError('Unable to process the payment. Please try again.') }
  })
  const field = (name: keyof CardFormFields, label: string, placeholder: string, maxLength: number) => {
    const message = form.formState.errors[name]?.message
    return <label className="coord-form-field"><span>{label}</span><input className="coord-input" placeholder={placeholder} maxLength={maxLength} autoComplete="off" inputMode={name === 'cardNumber' || name === 'securityCode' ? 'numeric' : 'text'} type={name === 'securityCode' ? 'password' : 'text'} {...form.register(name)} aria-invalid={!!message} aria-describedby={message ? `${name}-error` : undefined} />{message && <span id={`${name}-error`} className="coord-field-error" role="alert">{message}</span>}</label>
  }
  return <div className="coord-page"><BillingBreadcrumb to={`/customer/quotations/${quotation.id}`} current="Payment">Quotation {details.order.id}</BillingBreadcrumb><div className="coord-page-heading"><div><h1>Pay for {details.order.id}</h1><p>You accepted the fare quotation.</p></div></div>{error && <ErrorState message={error} />}
    {!eligible ? <CustomerCard title={paid ? 'Payment already recorded' : 'Payment unavailable'}><div className="coord-card-body"><p>{paid ? 'This order already has a successful payment record.' : 'Only accepted quotations can be paid.'}</p><Link className="coord-link" to={paid ? `/customer/payments/${paid.id}/success` : `/customer/quotations/${quotation.id}`}>{paid ? 'View payment' : 'Back to quotation'}</Link></div></CustomerCard> : <form noValidate onSubmit={submit} className="billing-grid payment"><div className="billing-card-payment"><CustomerCard title="Pay by debit or credit card" action={<span className="billing-card-brands">VISA / Mastercard / Amex</span>}><fieldset disabled={form.formState.isSubmitting} className="customer-form-body"><legend className="sr-only">Card payment</legend>
      {field('nameOnCard', 'Name on card', 'Name on the test card', 100)}{field('cardNumber', 'Card number', '0000 0000 0000 0000', 19)}<div className="customer-form-grid">{field('expiry', 'Expiry date', 'MM / YY', 7)}{field('securityCode', 'Security code (CVV)', '•••', 3)}</div>
      <p className="billing-security"><img src={lock} alt="" />Use the fictional test cards below. No funds are transferred and no card data is stored.</p>
      {cards.length > 0 && <details className="billing-test-cards"><summary>Fictional test card details</summary>{cards.map((card) => <div key={card.id}><strong>{card.label}</strong><code>{card.number} · {card.expiry} · CVV {card.securityCode}</code><button type="button" className="coord-button secondary small" onClick={() => { form.reset({ nameOnCard: card.name, cardNumber: card.number, expiry: card.expiry, securityCode: card.securityCode }); setError('') }}>Use this card<span className="sr-only"> for {card.label.toLowerCase()}</span></button></div>)}</details>}
    </fieldset></CustomerCard></div><aside className="customer-column"><CustomerCard title="Payment summary"><div className="coord-card-body"><BillingFacts rows={[
      ['Order', details.order.id], ['Route', `${details.order.origin} → ${details.order.destination}`], ['Pickup', customerDate(details.order.pickupAt)], ['Fare quotation', customerMoney(quotation.amount)],
    ]} /><div className="billing-charge total"><strong>Total to pay</strong><span className="coord-mono">{customerMoney(quotation.amount)}</span></div><button className="coord-button" disabled={form.formState.isSubmitting || !cards.length}>{form.formState.isSubmitting ? 'Processing…' : pending ? 'Resume payment' : `Pay ${customerMoney(quotation.amount)}`}</button><Link className="coord-link billing-back" to={`/customer/quotations/${quotation.id}`}>Back to quotation</Link></div></CustomerCard></aside></form>}
  </div>
}
