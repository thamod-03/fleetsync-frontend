import { loginSchema, passwordResetSchema, recoverySchema, registrationSchema, staffApplicationSchema } from '../features/auth/auth-schemas.ts'
import type { LoginInput, PasswordResetInput, RecoveryInput, RegistrationInput, StaffApplicationInput } from '../features/auth/auth-schemas.ts'
import type { DemoStore } from '../store/demo-store.ts'
import { webRoles } from '../types/domain.ts'
import type { LoginResult, ServiceResult } from '../services/contracts.ts'
export type { LoginResult } from '../services/contracts.ts'

// Public fictional demo credential, never a real user's password.
export const DEMO_PASSWORD = 'FleetSyncDemo1!'
export const RESET_REQUEST_MESSAGE = 'Email delivery is not connected. No reset email was sent.'
export const RESET_SUCCESS_MESSAGE = 'Password updates are not connected. Your password has not been changed.'

export function createAuthServices(store: DemoStore, delayMs: number, now: () => number = Date.now) {
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs))
  return {
    async login(input: LoginInput): Promise<LoginResult> {
      await wait()
      const parsed = loginSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: 'Enter a valid email address and password.' }
      const { data } = store.getState()
      const previous = data.loginAttempts.find((attempt) => attempt.id === parsed.data.email)
      if (previous && previous.lockedUntil > now()) return { ok: false, error: 'This account is locked for 15 minutes. Please try again later.', attemptsLeft: 0, lockedUntil: previous.lockedUntil }
      const user = store.getState().data.users.find((item) => item.email.toLowerCase() === parsed.data.email)
      const role = webRoles.find((item) => item === user?.role)
      if (!user || !role || user.accountStatus === 'Pending' || parsed.data.password !== DEMO_PASSWORD) {
        const failures = (previous?.lockedUntil ? 0 : previous?.failures ?? 0) + 1
        const lockedUntil = failures >= 5 ? now() + 15 * 60 * 1000 : 0
        store.setState({ data: { ...data, loginAttempts: [...data.loginAttempts.filter((attempt) => attempt.id !== parsed.data.email), { id: parsed.data.email, failures, lockedUntil }] } })
        return { ok: false, error: 'Check your details and try again. After 5 failed attempts the account is locked for 15 minutes.', attemptsLeft: 5 - failures, lockedUntil }
      }
      store.setState({ sessionUserId: user.id, rememberSession: parsed.data.rememberSession ?? true,
        data: { ...data, loginAttempts: data.loginAttempts.filter((attempt) => attempt.id !== parsed.data.email) } })
      return { ok: true, data: { ...user, role } }
    },
    async requestPasswordReset(input: RecoveryInput): Promise<ServiceResult<{ message: string }>> {
      await wait()
      if (!recoverySchema.safeParse(input).success) return { ok: false, error: 'Enter a valid email address.' }
      // Deliberately identical for known/unknown addresses; no delivery, token or stored input.
      return { ok: true, data: { message: RESET_REQUEST_MESSAGE } }
    },
    async simulatePasswordReset(input: PasswordResetInput): Promise<ServiceResult<{ message: string }>> {
      await wait()
      const parsed = passwordResetSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check your new password.' }
      if (parsed.data.password === DEMO_PASSWORD) return { ok: false, error: 'Use a password you haven’t used before.' }
      // Rehearses validation/success only. Submitted passwords never enter shared data or storage.
      return { ok: true, data: { message: RESET_SUCCESS_MESSAGE } }
    },
    async registerCustomer(input: RegistrationInput): Promise<ServiceResult<{ registrationId: string }>> {
      await wait()
      const parsed = registrationSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: 'Check the required fields and confirm your password and terms of service.' }
      const values = parsed.data
      const { data } = store.getState()
      if (data.users.some((user) => user.email.toLowerCase() === values.email) || data.staffApplications.some((application) => application.email === values.email)) return { ok: false, error: 'This email already has an account or pending application.' }
      const registrationId = `registration-${crypto.randomUUID()}`
      const userId = `user-${crypto.randomUUID()}`
      const customerId = `customer-${crypto.randomUUID()}`
      const companyId = `company-${crypto.randomUUID()}`
      store.setState({ data: { ...data,
        users: [...data.users, { id: userId, name: values.fullName, email: values.email, role: 'customer', accountStatus: 'Pending' }],
        customers: [...data.customers, { id: customerId, userId, companyId, mobile: values.mobile }],
        customerCompanies: [...data.customerCompanies, { id: companyId, name: values.companyName, businessRegistrationNumber: values.businessRegistrationNumber, billingAddress: values.billingAddress }],
        customerRegistrations: [...data.customerRegistrations, { id: registrationId, customerId, status: 'Pending', createdAt: new Date(now()).toISOString() }],
      } })
      return { ok: true, data: { registrationId } }
    },
    async submitStaffApplication(input: StaffApplicationInput): Promise<ServiceResult<{ applicationId: string }>> {
      await wait()
      const parsed = staffApplicationSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: 'Check your details and required documents.' }
      const { data } = store.getState()
      const values = parsed.data
      if (data.users.some((user) => user.email.toLowerCase() === values.email) || data.staffApplications.some((application) => application.email === values.email)) return { ok: false, error: 'This email already has an account or pending application.' }
      const applicationId = `application-${crypto.randomUUID()}`
      const details = { fullName: values.fullName, nicNumber: values.nicNumber, email: values.email, mobile: values.mobile, role: values.role, documents: values.documents }
      store.setState({ data: { ...data, staffApplications: [...data.staffApplications, { ...details, id: applicationId, status: 'Pending', createdAt: new Date(now()).toISOString() }] } })
      return { ok: true, data: { applicationId } }
    },
    async getPendingApplications() {
      await wait()
      const { data, sessionUserId } = store.getState()
      if (!data.users.some((user) => user.id === sessionUserId && user.role === 'admin')) return { ok: false as const, error: 'Only the Administrator demo persona can review applications.' }
      return { ok: true as const, data: structuredClone({ staffApplications: data.staffApplications, customerRegistrations: data.customerRegistrations,
        customers: data.customers, customerCompanies: data.customerCompanies, users: data.users }) }
    },
  }
}
