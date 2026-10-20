import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { Download, FileText } from 'lucide-react'
import { applicationServices } from '../../services/application-services'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/page-states'
import { reportFiltersSchema, reportTypes } from '../../types/reporting'
import type { OperationalReport, ReportContext, ReportFilters } from '../../types/reporting'
import { downloadReportCsv, printReport } from '../../lib/report-export'
import { CoordinatorCard } from './coordinator-components'
import { useCoordinatorQuery } from './use-coordinator-query'
import './workspace.css'

const descriptions = ['Trips by status, distance and revenue', 'Days on trips, idle and in service', 'Trips and distance per driver', 'Orders, quotations and payment status']

export function ReportsPage() {
  const { result, retry } = useCoordinatorQuery(applicationServices.getReportContext)
  if (!result) return <div className="coord-page"><LoadingState label="Loading report settings…" /></div>
  if (!result.ok) return <div className="coord-page"><ErrorState message={result.error} onRetry={retry} /></div>
  return <ReportsWorkspace context={result.data} />
}

export function ReportsWorkspace({ context }: { context: ReportContext }) {
  const today = new Date().toISOString().slice(0, 10)
  const form = useForm<ReportFilters>({ resolver: zodResolver(reportFiltersSchema), defaultValues: { type: 'Trip summary', start: `${today.slice(0, 7)}-01`, end: today, base: '', customerId: '' } })
  const [report, setReport] = useState<OperationalReport | null>(null)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const generate = form.handleSubmit(async (filters) => {
    setError('')
    try { const result = await applicationServices.generateReport(filters); if (result.ok) setReport(result.data); else setError(result.error) }
    catch { setError('Unable to generate the report. Please try again.') }
  })
  const exportReport = async (snapshot: OperationalReport, format: 'CSV' | 'PDF') => {
    setError(''); setExporting(true)
    try {
      const filename = `fleetsync-${snapshot.filters.type.toLowerCase().replaceAll(' ', '-')}-${snapshot.filters.start}-to-${snapshot.filters.end}.csv`
      if (format === 'PDF' && !printReport(snapshot)) { setError('Allow the report window to open, then try again.'); return }
      if (format === 'CSV') downloadReportCsv(snapshot, filename)
      const result = await applicationServices.recordReportExport(snapshot, format)
      if (!result.ok) setError(result.error)
    } catch { setError('Unable to prepare the export. Please try again.') }
    finally { setExporting(false) }
  }
  return <div className="coord-page">
    <div className="coord-page-heading"><div><h1>Operational reports</h1><p>Generate a report for a period, check it here, then export it as PDF or CSV.</p></div></div>
    {error && <ErrorState message={error} />}
    <div className="report-workspace"><aside className="report-settings">
      <CoordinatorCard title="Report settings"><form className="coord-card-body" onSubmit={generate} noValidate>
        <fieldset disabled={form.formState.isSubmitting}><legend className="workspace-label">Report type</legend><div className="report-types">{reportTypes.map((type, index) => <label key={type} className="report-type"><input type="radio" value={type} {...form.register('type')} /><span><strong>{type}</strong><small>{descriptions[index]}</small></span></label>)}</div></fieldset>
        <fieldset className="report-dates" disabled={form.formState.isSubmitting}><legend className="workspace-label">Period (UTC)</legend>{(['start', 'end'] as const).map((field) => <label className="coord-form-field" key={field}><span>{field === 'start' ? 'From' : 'To'}</span><input type="date" className="coord-input" {...form.register(field)} aria-invalid={!!form.formState.errors[field]} aria-describedby={`${field}-error`} />{form.formState.errors[field] && <span className="coord-field-error" id={`${field}-error`}>{form.formState.errors[field]?.message}</span>}</label>)}</fieldset>
        <label className="coord-form-field"><span>Base</span><select className="coord-input" {...form.register('base')}><option value="">All bases</option>{context.bases.map((base) => <option key={base}>{base}</option>)}</select></label>
        <label className="coord-form-field"><span>Customer</span><select className="coord-input" {...form.register('customerId')}><option value="">All customers</option>{context.customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
        <button className="coord-button" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Generating…' : 'Generate report'}</button>
      </form></CoordinatorCard>
      <CoordinatorCard title="Recent exports"><div className="report-exports">{context.exports.length ? context.exports.slice().reverse().slice(0, 5).map((entry) => <button key={entry.id} disabled={exporting} onClick={() => void exportReport(entry.report, entry.format)}><FileText size={18} aria-hidden="true" /><span>{entry.report.filters.type}<small>{entry.format} · {entry.report.filters.start} – {entry.report.filters.end}</small></span><Download size={16} aria-hidden="true" /></button>) : <p className="coord-helper">No exports prepared.</p>}</div></CoordinatorCard>
    </aside>
      {report ? <ReportResults report={report} exporting={exporting} onExport={(format) => void exportReport(report, format)} /> : <EmptyState title="No report generated" description="Choose the report settings, then generate a report." />}
    </div>
  </div>
}

export function ReportResults({ report, exporting = false, onExport }: { report: OperationalReport; exporting?: boolean; onExport?: (format: 'CSV' | 'PDF') => void }) {
  return <CoordinatorCard title={`${report.filters.type} · ${report.filters.start} – ${report.filters.end}`} subtitle={`Generated ${new Date(report.generatedAt).toLocaleString('en-GB')} by ${report.generatedBy}`} action={<div className="coord-actions"><button className="coord-button secondary small" disabled={exporting || !onExport} onClick={() => onExport?.('PDF')}>Export PDF</button><button className="coord-button secondary small" disabled={exporting || !onExport} onClick={() => onExport?.('CSV')}>Export CSV</button></div>}>
    <div className="coord-card-body"><div className="report-kpis">{report.cards.map((card) => <section key={card.label}><h3>{card.label}</h3><strong>{card.value}</strong><small>{card.note}</small></section>)}</div>
      {report.filters.type !== 'Orders and payments' && <section aria-label="Trips completed per day"><h3>Trips completed per day</h3>{report.chart.length ? <div className="report-chart"><ResponsiveContainer width="100%" height={180}><BarChart data={report.chart}><XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} /><Tooltip /><Bar dataKey="completed" name="Trips completed" fill="#4f46e5" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="coord-helper">No completed trips in this period.</p>}</section>}
      {report.rows.length ? <div className="workspace-table"><table><caption className="sr-only">{report.filters.type} results</caption><thead><tr>{report.columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead><tbody>{report.rows.map((row) => <tr key={row.id} className={row.id === '__total' ? 'report-total' : ''}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div> : <EmptyState title="No matching records" description="Try a different period, base or customer." />}
      <details className="report-notes"><summary>Report data and calculation basis</summary>{report.notes.map((note) => <p key={note}>{note}</p>)}<p>PDF opens the browser print dialog; choose Save as PDF. CSV is spreadsheet-compatible.</p></details>
    </div>
  </CoordinatorCard>
}
