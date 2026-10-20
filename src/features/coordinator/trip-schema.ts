import { z } from 'zod'
import { assignmentSchema } from '../../types/domain.ts'
import { tripInputSchema } from '../../types/trip-assignment.ts'

const localTimestamp = z.string().min(1, 'Choose a date and time.').refine((value) => Number.isFinite(Date.parse(value)), 'Choose a valid date and time.').transform((value) => new Date(value).toISOString())
export const tripFormSchema = z.object({
  orderId: z.string().min(1, 'Select a customer order.'), assignment: assignmentSchema,
  scheduledStart: localTimestamp, scheduledEnd: localTimestamp,
}).superRefine((value, context) => {
  const result = tripInputSchema.safeParse(value)
  if (!result.success) for (const issue of result.error.issues) context.addIssue({ code: 'custom', path: issue.path, message: issue.message })
})
export type TripFormValues = z.input<typeof tripFormSchema>
export type TripFormResult = z.output<typeof tripFormSchema>
