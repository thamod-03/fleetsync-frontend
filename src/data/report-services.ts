import type { DemoStore } from '../store/demo-store.ts'
import type { DemoDataset, Trip } from '../types/domain.ts'
import { reportFiltersSchema, reportResultSchema } from '../types/reporting.ts'
import type { OperationalReport, ReportContext, ReportExport, ReportFilters } from '../types/reporting.ts'
import type { ServiceResult } from '../services/contracts.ts'

const fail = (error: string) => ({ ok: false as const, error })
const day = (value: string) => value.slice(0, 10)
const distance = (trips: Trip[]): number | null => trips.some((trip) => trip.status === 'Completed' && trip.startingOdometer === undefined) ? null : trips.reduce((total, trip) => total + (trip.status === 'Completed' ? trip.finalOdometer - (trip.startingOdometer ?? trip.finalOdometer) : 0), 0)
const formatDistance = (value: number | null) => value === null ? 'Not recorded' : `${value.toLocaleString('en-GB')} km`
const money = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 2 })

export function projectReport(data: DemoDataset, filters: ReportFilters, generatedBy: string, generatedAt = new Date().toISOString()): OperationalReport {
  const inPeriod = (value: string) => day(value) >= filters.start && day(value) <= filters.end
  const customerOrders = data.orders.filter((order) => order.status !== 'Draft' && (!filters.customerId || order.customerId === filters.customerId))
  const tripDate = (trip: Trip) => trip.status === 'Completed' ? trip.actualReturnDate : trip.cancelledAt ?? trip.scheduledStart ?? trip.createdAt ?? data.orders.find((order) => order.id === trip.orderId)!.createdAt
  const baseMatches = (trip: Trip) => !filters.base || data.vehicles.some((item) => item.id === trip.assignment.vehicleId && item.homeBase === filters.base)
  const trips = data.trips.filter((trip) => customerOrders.some((order) => order.id === trip.orderId) && baseMatches(trip) && inPeriod(tripDate(trip)))
  const orders = customerOrders.filter((order) => inPeriod(order.createdAt) && (!filters.base || data.trips.some((trip) => trip.orderId === order.id && baseMatches(trip))))
  const cohort = filters.type === 'Orders and payments' ? orders.map((order) => order.id) : [...new Set(trips.map((trip) => trip.orderId))]
  const paymentsFor = (ids: string[]) => data.payments.filter((payment) => payment.status === 'Succeeded' && data.quotations.some((quote) => quote.id === payment.quotationId && ids.includes(quote.orderId)))
  const revenueFor = (ids: string[]) => paymentsFor(ids).reduce((sum, payment) => sum + payment.amount, 0)
  const completed = trips.filter((trip) => trip.status === 'Completed')
  const rows: OperationalReport['rows'] = []
  let columns: string[]
  if (filters.type === 'Orders and payments') {
    columns = ['Order', 'Customer', 'Status', 'Quotations', 'Payment status', 'Paid (LKR)']
    for (const order of orders) {
      const customer = data.customers.find((item) => item.id === order.customerId)
      const quotes = data.quotations.filter((item) => item.orderId === order.id && item.status !== 'Draft')
      const payments = data.payments.filter((payment) => quotes.some((quote) => quote.id === payment.quotationId))
      rows.push({ id: order.id, cells: [order.id, data.customerCompanies.find((item) => item.id === customer?.companyId)?.name ?? '', order.status, String(quotes.length), payments.some((item) => item.status === 'Succeeded') ? 'Paid' : payments.some((item) => item.status === 'Failed') ? 'Failed' : payments.length ? 'Pending' : 'Not recorded', money(revenueFor([order.id]))] })
    }
  } else if (filters.type === 'Vehicle utilisation') {
    columns = ['Vehicle', 'Trips', 'Completed', 'Scheduled days', 'Distance driven']
    for (const vehicle of data.vehicles.filter((item) => !filters.base || item.homeBase === filters.base)) {
      const assigned = trips.filter((trip) => trip.assignment.vehicleId === vehicle.id)
      if (filters.customerId && !assigned.length) continue
      const days = new Set<string>()
      for (const trip of assigned) if (trip.status !== 'Cancelled' && trip.scheduledStart && trip.scheduledEnd) {
        const end = Math.min(Date.parse(trip.scheduledEnd), Date.parse(filters.end) + 86400000 - 1)
        for (let value = Math.max(Date.parse(day(trip.scheduledStart)), Date.parse(filters.start)); value <= end; value += 86400000) days.add(day(new Date(value).toISOString()))
      }
      rows.push({ id: vehicle.id, cells: [vehicle.registration, String(assigned.length), String(assigned.filter((trip) => trip.status === 'Completed').length), assigned.some((trip) => !trip.scheduledStart) ? 'Not recorded' : String(days.size), formatDistance(distance(assigned))] })
    }
  } else if (filters.type === 'Driver activity') {
    columns = ['Driver', 'Trips', 'Completed', 'Cancelled', 'Distance driven']
    for (const driver of data.drivers) {
      const assigned = trips.filter((trip) => trip.assignment.driverId === driver.id)
      if ((filters.base || filters.customerId) && !assigned.length) continue
      rows.push({ id: driver.id, cells: [data.users.find((item) => item.id === driver.userId)?.name ?? driver.id, String(assigned.length), String(assigned.filter((trip) => trip.status === 'Completed').length), String(assigned.filter((trip) => trip.status === 'Cancelled').length), formatDistance(distance(assigned))] })
    }
  } else {
    columns = ['Vehicle type', 'Trips', 'Distance', 'Revenue (LKR)', 'Cancelled']
    const groups = [...new Set(trips.map((trip) => data.vehicles.find((item) => item.id === trip.assignment.vehicleId)!.description))]
    for (const group of groups) {
      const matching = trips.filter((trip) => data.vehicles.some((vehicle) => vehicle.id === trip.assignment.vehicleId && vehicle.description === group))
      const ids = [...new Set(matching.map((trip) => trip.orderId))]
      const ambiguousRevenue = ids.some((id) => data.trips.some((trip) => trip.orderId === id && data.vehicles.some((vehicle) => vehicle.id === trip.assignment.vehicleId && vehicle.description !== group)))
      rows.push({ id: group, cells: [group, String(matching.length), formatDistance(distance(matching)), ambiguousRevenue ? 'Not attributable' : money(revenueFor(ids)), String(matching.filter((trip) => trip.status === 'Cancelled').length)] })
    }
    if (rows.length) rows.push({ id: '__total', cells: ['Total', String(trips.length), formatDistance(distance(trips)), money(revenueFor(cohort)), String(trips.filter((trip) => trip.status === 'Cancelled').length)] })
  }
  const chart = [...new Set(completed.map((trip) => day(trip.actualReturnDate)))].sort().map((date) => ({ date, completed: completed.filter((trip) => day(trip.actualReturnDate) === date).length }))
  const paidOrders = new Set(paymentsFor(cohort).map((payment) => data.quotations.find((quote) => quote.id === payment.quotationId)!.orderId)).size
  return { filters, generatedAt, generatedBy, columns, rows, chart, cards: filters.type === 'Orders and payments' ? [
    { label: 'Orders', value: String(orders.length), note: 'Created in the selected period' },
    { label: 'Quotations', value: String(data.quotations.filter((quote) => cohort.includes(quote.orderId) && quote.status !== 'Draft').length), note: 'Issued for these orders' },
    { label: 'Paid orders', value: String(paidOrders), note: 'Recorded successful payments' },
    { label: 'Revenue', value: `LKR ${money(revenueFor(cohort))}`, note: 'For the selected order cohort' },
  ] : [
    { label: 'Trips completed', value: String(completed.length), note: `${trips.length} trips in selected cohort` },
    { label: 'Trips cancelled', value: String(trips.filter((trip) => trip.status === 'Cancelled').length), note: 'Recorded status' },
    { label: 'Distance driven', value: formatDistance(distance(trips)), note: 'From completed odometer entries' },
    { label: 'Revenue', value: `LKR ${money(revenueFor(cohort))}`, note: `${paidOrders} paid orders` },
  ], notes: [
    'Trip periods use actual return for Completed, cancellation time for Cancelled, otherwise scheduled start, creation time, or the related order creation date when trip dates are absent. Orders use creation dates. Dates are grouped in UTC.',
    `${paymentsFor(cohort).some((payment) => payment.createdAt || payment.completedAt) ? 'Legacy payments may have no recorded timestamps' : 'Payments have no recorded timestamps'}: revenue is recorded successful payments for the selected order cohort, not receipts during the period. Totals count each order once. Vehicle-type revenue is Not attributable when an order references several types; no allocation rule is assumed.`,
    'Missing starting odometers show Not recorded. Scheduled days are planned calendar dates, not measured utilisation. Idle/service history, maintenance costs and on-time rates are unavailable.',
  ] }
}

export function createReportServices(store: DemoStore, delayMs: number) {
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  const actor = () => store.getState().data.users.find((user) => user.id === store.getState().sessionUserId && user.role === 'coordinator' && user.accountStatus !== 'Pending')
  return {
    async getReportContext(): Promise<ServiceResult<ReportContext>> {
      await wait(); const user = actor()
      if (!user) return fail('Only Coordinators can access operational reports.')
      const { data } = store.getState()
      return { ok: true, data: structuredClone({ bases: [...new Set(data.vehicles.flatMap((vehicle) => vehicle.homeBase ? [vehicle.homeBase] : []))], customers: data.customers.map((customer) => ({ id: customer.id, name: data.customerCompanies.find((company) => company.id === customer.companyId)!.name })), exports: data.reportExports.filter((entry) => entry.actorId === user.id) }) }
    },
    async generateReport(input: ReportFilters): Promise<ServiceResult<OperationalReport>> {
      await wait(); const user = actor(); const parsed = reportFiltersSchema.safeParse(input)
      if (!user) return fail('Only Coordinators can access operational reports.')
      if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the report filters.')
      const { data } = store.getState()
      if ((input.base && !data.vehicles.some((vehicle) => vehicle.homeBase === input.base)) || (input.customerId && !data.customers.some((customer) => customer.id === input.customerId))) return fail('Choose an existing base and customer.')
      return { ok: true, data: projectReport(data, parsed.data, user.name) }
    },
    async recordReportExport(report: OperationalReport, format: 'CSV' | 'PDF'): Promise<ServiceResult<ReportExport>> {
      await wait(); const user = actor(); const parsed = reportResultSchema.safeParse(report)
      if (!user || !parsed.success || parsed.data.generatedBy !== user.name || !['CSV', 'PDF'].includes(format)) return fail('This report cannot be exported by your account.')
      const entry: ReportExport = { id: `export-${crypto.randomUUID()}`, actorId: user.id, format, report: parsed.data, filename: `fleetsync-${report.filters.type.toLowerCase().replaceAll(' ', '-')}-${report.filters.start}-to-${report.filters.end}.${format.toLowerCase()}` }
      const { data } = store.getState()
      store.setState({ data: { ...data, reportExports: [...data.reportExports, entry] } })
      return { ok: true, data: structuredClone(entry) }
    },
  }
}
