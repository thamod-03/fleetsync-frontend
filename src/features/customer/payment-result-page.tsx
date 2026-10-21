import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import { applicationServices } from '../../services/application-services'
import type { CustomerPayment } from '../../types/customer-billing'
import { ErrorState, LoadingState } from '../../components/ui/page-states'
import { useCoordinatorQuery } from '../coordinator/use-coordinator-query'
import { BillingFacts, InvoicePreview } from './billing-components'
import { customerDate, customerMoney } from './customer-format'
import successIcon from '../../assets/customer-billing/success.svg'
import failedIcon from '../../assets/customer-billing/failed.svg'
import './billing.css'

export function CustomerPaymentResultPage({ expected }: { expected: 'Succeeded' | 'Failed' }) {
  const { paymentId = '' } = useParams()
  const query = useCallback(() => applicationServices.getCustomerPayment(paymentId), [paymentId])
  const { result, retry } = useCoordinatorQuery(query)
  if (!result) return <div className="coord-page"><LoadingState /></div>
  if (!result.ok || result.data.payment.status !== expected) return <div className="coord-page"><ErrorState message={!result.ok ? result.error : 'This payment does not have the requested result. Check its current status in Payment History.'} onRetry={retry} /><Link className="coord-link" to="/customer/payments">Payment History</Link></div>
  return <PaymentResult data={result.data} />
}
export function PaymentResult({ data }: { data: CustomerPayment }) {
  const { payment, quotation, details } = data
  const success = payment.status === 'Succeeded'
  if (payment.status === 'Pending') return <p role="status">Payment is pending.</p>
  return <div className="coord-page"><div className="billing-result"><div className={`billing-result-icon ${success ? 'success' : 'failed'}`}><img src={success ? successIcon : failedIcon} alt="" /></div><h1>Payment {success ? 'successful' : 'failed'}</h1><p>{success ? `Payment recorded for ${details.order.id}. No funds were transferred.` : payment.failureReason ?? 'The local payment attempt failed. No funds were transferred.'}</p><div className="billing-result-facts"><BillingFacts rows={[
    ['Amount', customerMoney(payment.amount)], ['Paid with', payment.method], ['Reference', payment.reference ?? payment.id], ['Order', details.order.id], [success ? 'Date' : 'Attempt', customerDate(payment.completedAt ?? payment.createdAt)], ...(!success ? [['Reason', payment.failureReason ?? 'Not recorded'] as [string, string]] : []),
  ]} /></div><div className="billing-result-actions">{success ? <><Link className="coord-button secondary" to={`/customer/payments/${payment.id}/invoice`}>View invoice</Link><Link className="coord-button" to="/customer/orders">View my orders</Link></> : <><Link className="coord-button secondary" to={`/customer/quotations/${quotation.id}`}>Back to quotation</Link><Link className="coord-button" to={`/customer/quotations/${quotation.id}/payment`}>Try again</Link></>}</div><Link className="coord-link" to="/customer/payments">Payment History</Link>{success && <small>No external payment or receipt email was sent.</small>}</div></div>
}
export function CustomerInvoicePage() {
  const { paymentId = '' } = useParams()
  const query = useCallback(() => applicationServices.getCustomerInvoice(paymentId), [paymentId])
  const { result, retry } = useCoordinatorQuery(query)
  return <div className="coord-page"><Link className="coord-link" to="/customer/payments">Back to Payment History</Link>{!result ? <LoadingState /> : !result.ok ? <ErrorState message={result.error} onRetry={retry} /> : <div className="billing-invoice-page"><InvoicePreview data={result.data.transaction} reason={result.data.reason} /></div>}</div>
}
