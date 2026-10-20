import { z } from 'zod'

export const reportTypes = ['Trip summary', 'Vehicle utilisation', 'Driver activity', 'Orders and payments'] as const
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date.').refine((value) => {
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}, 'Choose a valid date.')
export const reportFiltersSchema = z.object({
  type: z.enum(reportTypes), start: date, end: date, base: z.string(), customerId: z.string(),
}).refine((input) => input.end >= input.start, { message: 'End date must be on or after start date.', path: ['end'] })
export const reportResultSchema = z.object({
  filters: reportFiltersSchema, generatedAt: z.iso.datetime(), generatedBy: z.string(),
  columns: z.array(z.string()), rows: z.array(z.object({ id: z.string(), cells: z.array(z.string()) })),
  cards: z.array(z.object({ label: z.string(), value: z.string(), note: z.string() })),
  chart: z.array(z.object({ date: z.string(), completed: z.number().nonnegative() })),
  notes: z.array(z.string()),
})
export const reportExportSchema = z.object({ id: z.string(), actorId: z.string(), format: z.enum(['CSV', 'PDF']), filename: z.string(), report: reportResultSchema })
export type ReportFilters = z.infer<typeof reportFiltersSchema>
export type OperationalReport = z.infer<typeof reportResultSchema>
export type ReportExport = z.infer<typeof reportExportSchema>
export interface ReportContext { bases: string[]; customers: { id: string; name: string }[]; exports: ReportExport[] }
