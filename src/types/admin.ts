import { z } from 'zod'
import type { AuditEvent, Customer, CustomerCompany, DemoDataset, Driver, Mechanic, User, UserRole } from './domain.ts'

export const adminRoleLabels: Record<UserRole, string> = { admin: 'Fleet Administrator', customer: 'Customer', coordinator: 'Operational Coordinator', driver: 'Driver', mechanic: 'Mechanic' }
export type StaffApplication = DemoDataset['staffApplications'][number]
export interface AdminUser {
  user: User
  customer?: Customer
  company?: CustomerCompany
  driver?: Driver
  mechanic?: Mechanic
  mobile?: string
  joinedAt?: string
  activity: AuditEvent[]
}
export interface AdminApplication {
  id: string; name: string; email: string; mobile?: string; createdAt: string
  kind: 'Staff' | 'Customer'; role: UserRole; status: 'Pending' | 'Approved' | 'Rejected'
  staff?: StaffApplication; customer?: Customer; company?: CustomerCompany; activity: AuditEvent[]
}
export interface AdminWorkspace {
  actor: User; capturedAt: string; users: AdminUser[]; applications: AdminApplication[]
  companies: CustomerCompany[]; activity: (AuditEvent & { actorName: string })[]
}
const versionedApplication = {
  applicationId: z.string().min(1), expectedRevision: z.number().int().nonnegative(),
}
export const applicationNoteSchema = z.object({ ...versionedApplication, note: z.string().trim().max(2000, 'Use at most 2,000 characters.') })
export const applicationDecisionSchema = z.object({
  ...versionedApplication, decision: z.enum(['Approved', 'Rejected']),
  reason: z.string().trim().max(500, 'Use at most 500 characters.'),
  applicantMessage: z.string().trim().max(2000, 'Use at most 2,000 characters.'),
  note: z.string().trim().max(2000, 'Use at most 2,000 characters.'),
}).superRefine((input, context) => {
  if (input.decision === 'Rejected' && !input.reason) context.addIssue({ code: 'custom', path: ['reason'], message: 'Select a rejection reason.' })
})
export type ApplicationNoteInput = z.infer<typeof applicationNoteSchema>
export type ApplicationDecisionInput = z.infer<typeof applicationDecisionSchema>

export function filterAdminUsers(users: AdminUser[], search: string, role: string, status: string) {
  const term = search.trim().toLowerCase()
  return users.filter(({ user }) => (!term || `${user.name} ${user.email}`.toLowerCase().includes(term)) && (role === 'all' || user.role === role) && (status === 'all' || (user.accountStatus ?? 'Active') === status))
}
