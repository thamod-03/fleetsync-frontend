import { z } from 'zod'
import { quotationInputSchema } from '../../types/quotation.ts'

export const quotationFormSchema = quotationInputSchema.omit({ orderId: true, draftId: true }).extend({
  validUntil: z.string().min(1, 'Choose a validity date and time.').refine((value) => Number.isFinite(new Date(value).getTime()), 'Choose a valid date and time.').transform((value) => new Date(value).toISOString()),
})
export type QuotationFormInput = z.input<typeof quotationFormSchema>
export type QuotationFormValues = z.output<typeof quotationFormSchema>
export function localDateTime(value: string | undefined) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
