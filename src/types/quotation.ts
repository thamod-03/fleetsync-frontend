import { z } from 'zod'

export const fareChargesSchema = z.object({
  distance: z.number().finite().nonnegative().max(1_000_000_000),
  load: z.number().finite().nonnegative().max(1_000_000_000),
  loading: z.number().finite().nonnegative().max(1_000_000_000),
  handling: z.number().finite().nonnegative().max(1_000_000_000),
  tolls: z.number().finite().nonnegative().max(1_000_000_000),
})
export const quotationInputSchema = z.object({
  orderId: z.string().min(1), draftId: z.string().min(1).optional(),
  vehicleType: z.string().trim().min(1, 'Select a vehicle type.').max(100),
  charges: fareChargesSchema,
  validUntil: z.iso.datetime({ message: 'Choose a valid expiry date and time.' }),
  message: z.string().trim().max(2000, 'Use at most 2,000 characters.'),
})
export type QuotationInput = z.infer<typeof quotationInputSchema>
export type FareCharges = z.infer<typeof fareChargesSchema>
export const totalFare = (charges: FareCharges) => Math.round(Object.values(charges).reduce((sum, amount) => sum + amount, 0) * 100) / 100
