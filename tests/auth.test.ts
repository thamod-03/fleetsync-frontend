import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMockServices } from '../src/data/mock-services.ts'
import { DEMO_PASSWORD, RESET_REQUEST_MESSAGE, RESET_SUCCESS_MESSAGE } from '../src/data/auth-services.ts'
import { createDemoStore } from '../src/store/demo-store.ts'
import { DEMO_STORAGE_KEY, type StoragePort } from '../src/lib/demo-storage.ts'
import { loginSchema, passwordResetSchema, recoverySchema } from '../src/features/auth/auth-schemas.ts'
import { getLoginDestination } from '../src/routes/access.ts'
import { registrationSchema, staffApplicationSchema } from '../src/features/auth/auth-schemas.ts'
import { createAuthServices } from '../src/data/auth-services.ts'
import { createSeedData } from '../src/data/seed.ts'
import { demoDatasetSchema } from '../src/types/domain.ts'
import { demoDocuments } from '../src/data/demo-documents.ts'
import { zodResolver } from '@hookform/resolvers/zod'
import { unavailableAdapter } from '../src/services/unavailable-adapter.ts'

function setup() {
  const saved = new Map<string, string>()
  const storage: StoragePort = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => { saved.set(key, value) } }
  const store = createDemoStore(storage)
  return { store, storage, saved, services: createMockServices(store, 0) }
}

test('credential login accepts each existing web persona and preserves shared records', async () => {
  const { store, storage, services } = setup()
  const data = structuredClone(store.getState().data)
  for (const role of ['admin', 'customer', 'coordinator'] as const) {
    const user = data.users.find((item) => item.role === role)!
    const result = await services.login({ email: ` ${user.email.toUpperCase()} `, password: DEMO_PASSWORD })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(getLoginDestination(result.data.role, null), `/${role}`)
    assert.equal(createDemoStore(storage).getState().sessionUserId, user.id)
    assert.deepEqual(store.getState().data, data)
  }
  await services.logout()
  assert.equal(createDemoStore(storage).getState().sessionUserId, null)
  assert.deepEqual(createDemoStore(storage).getState().data, data)
})

test('invalid credentials and mobile roles cannot create a web session', async () => {
  const { store, services } = setup()
  for (const [email, password] of [
    ['not-an-email', DEMO_PASSWORD], ['alex@fleetsync.example', ''],
    ['alex@fleetsync.example', 'incorrect-demo-password'], ['unknown@fictional.example', DEMO_PASSWORD],
    ['nilan@fleetsync.example', DEMO_PASSWORD], ['dev@fleetsync.example', DEMO_PASSWORD],
  ]) {
    assert.equal((await services.login({ email: email!, password: password! })).ok, false)
    assert.equal(store.getState().sessionUserId, null)
  }
  await services.signIn('customer')
  assert.equal((await services.login({ email: 'alex@fleetsync.example', password: 'wrong' })).ok, false)
  assert.equal(store.getState().sessionUserId, 'user-customer')
})

test('recovery validates email and does not disclose whether an address exists', async () => {
  const { saved, services } = setup()
  const before = saved.get(DEMO_STORAGE_KEY)
  assert.equal((await services.requestPasswordReset({ email: 'invalid' })).ok, false)
  for (const email of ['alex@fleetsync.example', 'unknown@fictional.example']) {
    assert.deepEqual(await services.requestPasswordReset({ email }), { ok: true, data: { message: RESET_REQUEST_MESSAGE } })
  }
  assert.equal(saved.get(DEMO_STORAGE_KEY), before)
})

test('reset rehearsal validates strength/matching and never persists submitted passwords', async () => {
  const { saved, services } = setup()
  const before = saved.get(DEMO_STORAGE_KEY)
  const validPassword = 'FictionalReset42'
  for (const password of ['Short1', 'alllowercase123', 'ALLUPPERCASE123', 'MissingNumbers']) {
    assert.equal((await services.simulatePasswordReset({ password, confirmPassword: password })).ok, false)
  }
  assert.equal((await services.simulatePasswordReset({ password: validPassword, confirmPassword: 'Different42' })).ok, false)
  assert.deepEqual(await services.simulatePasswordReset({ password: validPassword, confirmPassword: validPassword }), { ok: true, data: { message: RESET_SUCCESS_MESSAGE } })
  assert.equal(saved.get(DEMO_STORAGE_KEY), before)
  assert.equal(saved.get(DEMO_STORAGE_KEY)?.includes(validPassword), false)
  assert.equal((await services.login({ email: 'alex@fleetsync.example', password: DEMO_PASSWORD })).ok, true)
})

test('schemas normalize emails and identify confirmation field errors for form integration', () => {
  assert.deepEqual(loginSchema.parse({ email: ' ALEX@FLEETSYNC.EXAMPLE ', password: DEMO_PASSWORD }), { email: 'alex@fleetsync.example', password: DEMO_PASSWORD })
  assert.equal(recoverySchema.safeParse({ email: '' }).success, false)
  const mismatch = passwordResetSchema.safeParse({ password: 'FictionalReset42', confirmPassword: 'Wrong42' })
  assert.equal(mismatch.success, false)
  if (!mismatch.success) assert.ok(mismatch.error.issues.some((issue) => issue.path[0] === 'confirmPassword'))
})

const registration = {
  companyName: 'Demo Northstar', businessRegistrationNumber: 'DEMO-BR-002', billingAddress: '2 Fictional Road',
  fullName: 'Tara Example', mobile: '077 000 0000', email: 'tara@northstar.example',
  password: 'FictionalRegistration42', confirmPassword: 'FictionalRegistration42', termsAccepted: true,
}
const application = {
  fullName: 'Demo Applicant', nicNumber: 'DEMO-NIC-001', mobile: '077 000 0000', email: 'applicant@staff.example',
  role: 'driver' as const, documents: structuredClone(demoDocuments), detailsConfirmed: true,
}

test('registration persists linked person/customer/company records pending approval without password data', async () => {
  const { services, store, storage, saved } = setup()
  const result = await services.registerCustomer(registration)
  assert.equal(result.ok, true)
  const data = createDemoStore(storage).getState().data
  const user = data.users.find((item) => item.email === registration.email)!
  assert.equal(user.accountStatus, 'Pending')
  const customer = data.customers.find((item) => item.userId === user.id)!
  const company = data.customerCompanies.find((item) => item.id === customer.companyId)!
  assert.equal(company.name, registration.companyName)
  assert.equal(company.businessRegistrationNumber, registration.businessRegistrationNumber)
  assert.equal(data.customerRegistrations[0]?.customerId, customer.id)
  assert.equal(store.getState().sessionUserId, null)
  assert.equal(demoDatasetSchema.safeParse(data).success, true)
  assert.equal(saved.get(DEMO_STORAGE_KEY)?.includes(registration.password), false)
  assert.equal((await services.login({ email: registration.email, password: DEMO_PASSWORD })).ok, false)
  assert.equal((await services.registerCustomer(registration)).ok, false)
  await services.signIn('admin')
  const pending = await services.getPendingApplications()
  assert.equal(pending.ok && pending.data.customerRegistrations.length, 1)
  await services.resetDemoData()
  assert.deepEqual(createDemoStore(storage).getState().data, createSeedData())
})

test('staff submissions remain pending without creating users; only Admin can inspect them', async () => {
  const { services, store, storage } = setup()
  const before = store.getState().data.users.length
  assert.equal((await services.getPendingApplications()).ok, false)
  const results = await Promise.all([services.submitStaffApplication(application), services.submitStaffApplication(application)])
  assert.equal(results.filter((result) => result.ok).length, 1)
  const data = createDemoStore(storage).getState().data
  assert.equal(data.users.length, before)
  assert.equal(data.staffApplications.length, 1)
  assert.equal(data.staffApplications[0]?.status, 'Pending')
  assert.equal(data.staffApplications[0]?.documents.every((document) => document.simulated), true)
  assert.equal(demoDatasetSchema.safeParse(data).success, true)
  await services.signIn('customer')
  assert.equal((await services.getPendingApplications()).ok, false)
  await services.signIn('admin')
  const pending = await services.getPendingApplications()
  assert.equal(pending.ok && pending.data.staffApplications.length, 1)
})

test('registration/application validation rejects unconfirmed details, mismatches, empty NICs and missing driver documents', async () => {
  assert.equal(registrationSchema.safeParse({ ...registration, termsAccepted: false }).success, false)
  assert.equal(registrationSchema.safeParse({ ...registration, confirmPassword: 'Different42' }).success, false)
  assert.equal(staffApplicationSchema.safeParse({ ...application, detailsConfirmed: false }).success, false)
  assert.equal(staffApplicationSchema.safeParse({ ...application, nicNumber: ' ' }).success, false)
  assert.equal(staffApplicationSchema.safeParse({ ...application, nicNumber: '123456789012' }).success, true)
  assert.equal(staffApplicationSchema.safeParse({ ...application, documents: demoDocuments.filter((item) => item.kind === 'nic') }).success, false)
  assert.equal(staffApplicationSchema.safeParse({ ...application, role: 'mechanic', documents: demoDocuments.filter((item) => item.kind === 'nic') }).success, true)
  assert.equal(staffApplicationSchema.safeParse({ ...application, documents: [{ ...demoDocuments[0], sizeBytes: 6 * 1024 * 1024 }] }).success, false)
  const resolved = await zodResolver(registrationSchema)({ ...registration, email: '', termsAccepted: false }, undefined, { fields: {}, shouldUseNativeValidation: false })
  assert.ok(resolved.errors.email?.message)
  assert.ok(resolved.errors.termsAccepted?.message)
  const { services, store } = setup()
  assert.equal((await services.submitStaffApplication({ ...application, documents: [] })).ok, false)
  assert.equal(store.getState().data.staffApplications.length, 0)
})

test('unconfigured production adapter fails closed for credentials and does not establish a session', async () => {
  assert.equal(unavailableAdapter.getCurrentUser(), null)
  const result = await unavailableAdapter.services.login({ email: 'alex@fleetsync.example', password: DEMO_PASSWORD })
  assert.equal(result.ok, false)
  assert.equal(unavailableAdapter.getCurrentUser(), null)
  assert.equal((await unavailableAdapter.services.registerCustomer(registration)).ok, false)
  assert.equal((await unavailableAdapter.services.prepareDocuments([{ name: 'NIC.pdf', size: 100, type: 'application/pdf' }])).ok, false)
})

test('five failures trigger a persisted 15-minute demo lockout, and an expired lock permits login', async () => {
  const { store, storage } = setup()
  let time = 1000
  const services = createAuthServices(store, 0, () => time)
  for (let index = 1; index <= 5; index++) {
    const result = await services.login({ email: 'alex@fleetsync.example', password: 'wrong' })
    assert.equal(result.ok, false)
    assert.equal(result.attemptsLeft, 5 - index)
  }
  const reloaded = createDemoStore(storage)
  assert.equal((await createAuthServices(reloaded, 0, () => time).login({ email: 'alex@fleetsync.example', password: DEMO_PASSWORD })).ok, false)
  time += 15 * 60 * 1000
  assert.equal((await services.login({ email: 'alex@fleetsync.example', password: DEMO_PASSWORD })).ok, true)
  assert.equal(store.getState().data.loginAttempts.length, 0)
})

test('remember-session choice is respected and persona switching restores foundation persistence', async () => {
  const { services, store, storage } = setup()
  await services.login({ email: 'alex@fleetsync.example', password: DEMO_PASSWORD, rememberSession: false })
  assert.equal(store.getState().sessionUserId, 'user-admin')
  assert.equal(createDemoStore(storage).getState().sessionUserId, null)
  await services.signIn('customer')
  assert.equal(createDemoStore(storage).getState().sessionUserId, 'user-customer')
})

test('foundation snapshots without new auth collections migrate without losing orders or session', () => {
  const { storage } = setup()
  const legacy = createSeedData()
  const { customerRegistrations, staffApplications, loginAttempts, ...data } = legacy
  assert.deepEqual([customerRegistrations, staffApplications, loginAttempts], [[], [], []])
  data.orders[0]!.cargo = 'Previously edited fictional cargo'
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ version: 1, data, sessionUserId: 'user-customer' }))
  const restored = createDemoStore(storage).getState()
  assert.equal(restored.sessionUserId, 'user-customer')
  assert.equal(restored.data.orders[0]?.cargo, 'Previously edited fictional cargo')
  assert.deepEqual(restored.data.staffApplications, [])
  assert.equal(restored.storageNotice, null)
})
