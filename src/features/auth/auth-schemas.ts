import { z } from 'zod'
import { demoDocumentSchema, staffRoles } from '../../types/domain.ts'
export { staffRoles } from '../../types/domain.ts'
export type { DemoDocument } from '../../types/domain.ts'

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'))

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
  rememberSession: z.boolean().optional(),
})

export const recoverySchema = z.object({ email: emailSchema })

// Requirements shown in Figma's Set New Password frame.
export const newPasswordSchema = z.string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use no more than 128 characters.')
  .regex(/[a-z]/, 'Include a lowercase letter.')
  .regex(/[A-Z]/, 'Include an uppercase letter.')
  .regex(/[0-9]/, 'Include a number.')

export const passwordResetSchema = z.object({
  password: newPasswordSchema,
  confirmPassword: z.string().min(1, 'Confirm your new password.'),
}).refine((input) => input.password === input.confirmPassword, {
  path: ['confirmPassword'], message: 'Passwords do not match.',
})

export type LoginInput = z.infer<typeof loginSchema>
export type RecoveryInput = z.infer<typeof recoverySchema>
export type PasswordResetInput = z.infer<typeof passwordResetSchema>

const requiredText = z.string().trim().min(1, 'This field is required.').max(200, 'Use no more than 200 characters.')
const mobile = z.string().trim().regex(/^\+?[\d ()-]{9,20}$/, 'Enter a valid mobile number.')
export const registrationSchema = z.object({
  companyName: requiredText, businessRegistrationNumber: requiredText,
  billingAddress: requiredText, fullName: requiredText, mobile,
  email: emailSchema, password: newPasswordSchema, confirmPassword: z.string().min(1, 'Confirm your password.'),
  termsAccepted: z.boolean().refine(Boolean, 'Accept the terms of service to continue.'),
}).refine((input) => input.password === input.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' })

export const staffApplicationSchema = z.object({
  fullName: requiredText,
  nicNumber: z.string().trim().min(1, 'Enter your NIC number.').max(32, 'Check your NIC number.'),
  email: emailSchema, mobile, role: z.enum(staffRoles),
  documents: z.array(demoDocumentSchema).max(2),
  detailsConfirmed: z.boolean().refine(Boolean, 'Confirm that the details are correct.'),
}).superRefine((input, context) => {
  if (!input.documents.some((document) => document.kind === 'nic')) context.addIssue({ code: 'custom', path: ['documents'], message: 'Add a NIC copy.' })
  if (input.role === 'driver' && !input.documents.some((document) => document.kind === 'driving-licence')) context.addIssue({ code: 'custom', path: ['documents'], message: 'Drivers also need a driving licence.' })
  if (new Set(input.documents.map((document) => document.kind)).size !== input.documents.length) context.addIssue({ code: 'custom', path: ['documents'], message: 'Add each document only once.' })
})
export type RegistrationInput = z.infer<typeof registrationSchema>
export type StaffApplicationInput = z.infer<typeof staffApplicationSchema>
