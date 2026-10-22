import type { DemoStore } from '../store/demo-store.ts'
import type { AdminApplication, AdminUser, AdminWorkspace, ApplicationDecisionInput, ApplicationNoteInput } from '../types/admin.ts'
import { applicationDecisionSchema, applicationNoteSchema } from '../types/admin.ts'
import type { ServiceResult } from '../services/contracts.ts'
import type { MessageNotificationService } from '../services/message-notifications.ts'
import { localMessageNotifications } from './message-notifications.ts'
import type { DemoDataset } from '../types/domain.ts'

function projectAdmin(data: DemoDataset, actorId: string): AdminWorkspace {
  const activityFor = (id: string) => data.auditEvents.filter((event) => event.entityId === id || event.actorId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const users = data.users.map((user): AdminUser => {
    const customer = data.customers.find((item) => item.userId === user.id)
    const application = data.staffApplications.find((item) => item.userId === user.id)
    return { user, customer, company: data.customerCompanies.find((item) => item.id === customer?.companyId),
      driver: data.drivers.find((item) => item.userId === user.id), mechanic: data.mechanics.find((item) => item.userId === user.id),
      mobile: customer?.mobile ?? application?.mobile, joinedAt: customer?.joinedAt ?? application?.reviewedAt, activity: activityFor(user.id) }
  })
  const applications: AdminApplication[] = data.staffApplications.map((staff) => ({ id: staff.id, name: staff.fullName, email: staff.email, mobile: staff.mobile, createdAt: staff.createdAt, kind: 'Staff', role: staff.role, status: staff.status, staff, activity: activityFor(staff.id) }))
  for (const registration of data.customerRegistrations) {
    const person = users.find((item) => item.customer?.id === registration.customerId)
    if (person) applications.push({ id: registration.id, name: person.user.name, email: person.user.email, mobile: person.mobile, createdAt: registration.createdAt, kind: 'Customer', role: 'customer', status: registration.status, customer: person.customer, company: person.company, activity: activityFor(registration.id) })
  }
  return structuredClone({ actor: data.users.find((item) => item.id === actorId)!, capturedAt: new Date().toISOString(), users,
    companies: data.customerCompanies, applications: applications.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    activity: [...data.auditEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((event) => ({ ...event, actorName: data.users.find((user) => user.id === event.actorId)?.name ?? 'Not recorded' })) })
}

export function createAdminServices(store: DemoStore, delayMs = 180, notifications: MessageNotificationService = localMessageNotifications) {
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  const actor = () => { const state = store.getState(); return state.data.users.find((user) => user.id === state.sessionUserId && user.role === 'admin' && user.accountStatus !== 'Pending') }
  const failure = (error: string): { ok: false; error: string } => ({ ok: false, error })
  return {
    async getAdminWorkspace(): Promise<ServiceResult<AdminWorkspace>> {
      const actorId = actor()?.id; await wait()
      if (!actorId || actor()?.id !== actorId) return failure('Only Fleet Administrators can access account management.')
      return { ok: true, data: projectAdmin(store.getState().data, actorId) }
    },
    async getAdminUser(id: string): Promise<ServiceResult<AdminUser>> {
      const actorId = actor()?.id; await wait()
      if (!actorId || actor()?.id !== actorId) return failure('Only Fleet Administrators can access account management.')
      const user = projectAdmin(store.getState().data, actorId).users.find((item) => item.user.id === id)
      return user ? { ok: true, data: user } : failure('This user account is unavailable.')
    },
    async getAdminApplication(id: string): Promise<ServiceResult<AdminApplication>> {
      const actorId = actor()?.id; await wait()
      if (!actorId || actor()?.id !== actorId) return failure('Only Fleet Administrators can review applications.')
      const application = projectAdmin(store.getState().data, actorId).applications.find((item) => item.id === id)
      return application ? { ok: true, data: application } : failure('This application is unavailable.')
    },
    async saveApplicationNote(input: ApplicationNoteInput): Promise<ServiceResult<null>> {
      const actorId = actor()?.id; await wait()
      if (!actorId || actor()?.id !== actorId) return failure('Only Fleet Administrators can review applications.')
      const parsed = applicationNoteSchema.safeParse(input)
      if (!parsed.success) return failure('Check the application and note length.')
      const { data } = store.getState()
      const app = data.staffApplications.find((item) => item.id === parsed.data.applicationId)
      if (!app || app.status !== 'Pending' || (app.revision ?? 0) !== parsed.data.expectedRevision) return failure('This application has changed. Reload it before saving.')
      const at = new Date().toISOString()
      store.setState({ data: { ...data,
        staffApplications: data.staffApplications.map((item) => item.id === app.id ? { ...item, internalNote: parsed.data.note, revision: (item.revision ?? 0) + 1 } : item),
        auditEvents: [...data.auditEvents, { id: `audit-${crypto.randomUUID()}`, actorId, entityId: app.id, action: 'Updated application review note', createdAt: at }],
      } })
      return { ok: true, data: null }
    },
    async decideStaffApplication(input: ApplicationDecisionInput): Promise<ServiceResult<AdminApplication>> {
      const actorId = actor()?.id; await wait()
      if (!actorId || actor()?.id !== actorId) return failure('Only Fleet Administrators can decide applications.')
      const parsed = applicationDecisionSchema.safeParse(input)
      if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? 'Check the application decision.')
      const values = parsed.data; const { data } = store.getState()
      const app = data.staffApplications.find((item) => item.id === values.applicationId)
      if (!app || app.status !== 'Pending' || (app.revision ?? 0) !== values.expectedRevision) return failure('This application has changed or already has a decision. Reload it before continuing.')
      if (values.decision === 'Approved' && data.users.some((user) => user.email.toLowerCase() === app.email.toLowerCase())) return failure('An account already uses this email address.')
      if (values.decision === 'Approved' && (!app.documents.some((doc) => doc.kind === 'nic') || (app.role === 'driver' && !app.documents.some((doc) => doc.kind === 'driving-licence')))) return failure('Required document metadata is missing. The application cannot be approved.')
      const at = new Date().toISOString()
      const userId = values.decision === 'Approved' ? `user-${crypto.randomUUID()}` : undefined
      const updated = { ...app, status: values.decision, reviewedAt: at, reviewedBy: actorId, revision: (app.revision ?? 0) + 1, internalNote: values.note, ...(userId ? { userId } : { rejectionReason: values.reason }), applicantMessage: values.applicantMessage }
      let notices: DemoDataset['notifications']
      try { notices = userId ? notifications.prepare([userId], 'Your staff account application has been approved.', at) : [] }
      catch { return failure('Unable to prepare the account notification. No decision was saved.') }
      const next: DemoDataset = { ...data,
        users: userId ? [...data.users, { id: userId, name: app.fullName, email: app.email, role: app.role, accountStatus: 'Active' }] : data.users,
        drivers: userId && app.role === 'driver' ? [...data.drivers, { id: `driver-${crypto.randomUUID()}`, userId, available: false }] : data.drivers,
        mechanics: userId && app.role === 'mechanic' ? [...data.mechanics, { id: `mechanic-${crypto.randomUUID()}`, userId, available: false }] : data.mechanics,
        staffApplications: data.staffApplications.map((item) => item.id === app.id ? updated : item),
        auditEvents: [...data.auditEvents, { id: `audit-${crypto.randomUUID()}`, actorId, entityId: app.id, action: `${values.decision} staff application${values.reason && values.decision === 'Rejected' ? `: ${values.reason}` : ''}`, createdAt: at }, ...(userId ? [{ id: `audit-${crypto.randomUUID()}`, actorId, entityId: userId, action: 'Created account from approved staff application', createdAt: at }] : [])],
        notifications: [...data.notifications, ...notices],
      }
      store.setState({ data: next })
      return { ok: true, data: projectAdmin(next, actorId).applications.find((item) => item.id === app.id)! }
    },
  }
}
