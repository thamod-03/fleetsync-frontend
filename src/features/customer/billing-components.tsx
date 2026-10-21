import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import type { CustomerQuotation, CustomerPayment } from '../../types/customer-billing'
import { CustomerCard, CustomerStatus } from './customer-components'
import { customerDate, customerMoney } from './customer-format'
import pickup from '../../assets/customer-billing/pickup.svg'
import destination from '../../assets/customer-billing/destination.svg'
import logo from '../../assets/auth/logo.svg'

export function BillingBreadcrumb({ to, children, current }: { to: string; children: ReactNode; current: string }) {
  return <nav className="coord-breadcrumb" aria-label="Breadcrumb"><Link to={to}><ChevronLeft size={14} aria-hidden="true" />{children}</Link><span>/</span><span>{current}</span></nav>
}
export function BillingFacts({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="customer-payment-details">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? 'Not recorded'}</dd></div>)}</dl>
}
export function QuotationOrder({ data }: { data: CustomerQuotation }) {
  const { order } = data.details
  return <CustomerCard title="Your order"><div className="coord-card-body"><dl className="customer-route-grid">{[{ label: 'Pickup', value: order.pickupAddress ?? order.origin, date: order.pickupAt, icon: pickup }, { label: 'Destination', value: order.destinationAddress ?? order.destination, date: order.deliveryBy, icon: destination }].map((item) => <div className="billing-location" key={item.label}><img src={item.icon} alt="" /><div><dt>{item.label}</dt><dd>{item.value}</dd><small>{customerDate(item.date)}</small></div></div>)}</dl><dl className="customer-cargo-facts">{[['Cargo', order.cargo], ['Weight', order.weightTonnes ? `${order.weightTonnes * 1000} kg` : 'Not recorded'], ['Pallets', order.pallets ?? 'Not recorded'], ['Handling', order.handling ?? 'Not recorded']].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><Link className="coord-link" to={`/customer/orders/${order.id}`}>View order details</Link></div></CustomerCard>
}
export function InvoicePreview({ data, reason }: { data: CustomerPayment; reason: string }) {
  const { payment, details, quotation } = data
  return <CustomerCard title="Invoice preview" subtitle={`Selected: ${details.order.id}`} action={<CustomerStatus>Paid</CustomerStatus>}><div className="coord-card-body"><div className="billing-invoice-brand"><img src={logo} alt="" /><div><strong>FleetSync</strong><small>Payment record</small></div></div><BillingFacts rows={[
    ['Reference', payment.reference ?? payment.id], ['Recorded', customerDate(payment.completedAt ?? payment.createdAt)], ['Customer', details.contact.name], ['Company', details.company.name], ['Order', <Link className="coord-link" to={`/customer/orders/${details.order.id}`}>{details.order.id}</Link>], ['Quotation', quotation.id], ['Route', `${details.order.origin} → ${details.order.destination}`], ['Total recorded', customerMoney(payment.amount)], ['Method', payment.method],
  ]} /><p className="coord-helper" role="status">{reason}</p><button className="coord-button" disabled title={reason}>Download invoice (PDF)</button></div></CustomerCard>
}
