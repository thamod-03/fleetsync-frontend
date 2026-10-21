import type { CustomerPayment } from '../../types/customer-billing.ts'

export function filterPayments(items: CustomerPayment[], status: string, months: string, search: string, now: Date) {
  const start = new Date(now)
  if (months !== 'all') start.setUTCMonth(start.getUTCMonth() - Number(months))
  const text = search.trim().toLowerCase()
  return items.filter(({ payment, details }) => {
    const date = payment.completedAt ?? payment.createdAt
    return (status === 'all' || payment.status === status)
      && (months === 'all' || (!!date && Date.parse(date) >= start.getTime() && Date.parse(date) <= now.getTime()))
      && [payment.id, payment.reference, details.order.id, details.order.origin, details.order.destination].filter(Boolean).join(' ').toLowerCase().includes(text)
  })
}
export function paymentStatistics(items: CustomerPayment[], now: Date) {
  const paid = items.filter(({ payment }) => payment.status === 'Succeeded')
  const month = now.toISOString().slice(0, 7); const year = month.slice(0, 4)
  const thisMonth = paid.filter(({ payment }) => (payment.completedAt ?? payment.createdAt)?.startsWith(month))
  return {
    monthlyTotal: thisMonth.reduce((sum, { payment }) => sum + payment.amount, 0), monthlyCount: thisMonth.length,
    yearlyTotal: paid.filter(({ payment }) => (payment.completedAt ?? payment.createdAt)?.startsWith(year)).reduce((sum, { payment }) => sum + payment.amount, 0),
    failures: items.filter(({ payment }) => payment.status === 'Failed' && (payment.completedAt ?? payment.createdAt)?.startsWith(month)).length,
    last: [...paid].sort((a, b) => (b.payment.completedAt ?? b.payment.createdAt ?? '').localeCompare(a.payment.completedAt ?? a.payment.createdAt ?? '')).find(({ payment }) => payment.completedAt || payment.createdAt), undated: paid.filter(({ payment }) => !payment.completedAt && !payment.createdAt).length,
  }
}
