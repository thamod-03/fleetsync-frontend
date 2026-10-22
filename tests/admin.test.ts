import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemoStore } from '../src/store/demo-store.ts'
import { createMockServices } from '../src/data/mock-services.ts'
import { createAdminServices } from '../src/data/admin-services.ts'
import { demoDatasetSchema } from '../src/types/domain.ts'
import { filterAdminUsers } from '../src/types/admin.ts'
import type { ApplicationDecisionInput } from '../src/types/admin.ts'
import type { StaffApplicationInput } from '../src/features/auth/auth-schemas.ts'
import { unavailableAdapter } from '../src/services/unavailable-adapter.ts'
import { adminCsv } from '../src/features/admin/admin-export.ts'
import { DEMO_PASSWORD } from '../src/data/auth-services.ts'

function setup(delay = 0) {
  const saved = new Map<string, string>()
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value) } }
  const store = createDemoStore(storage)
  store.setState({ sessionUserId: 'user-admin', rememberSession: true })
  return { store, storage, services: createMockServices(store, delay) }
}
const application = (role: StaffApplicationInput['role'] = 'driver'): StaffApplicationInput => ({
  fullName: 'Ari Test', nicNumber: 'SYNTHETIC-NIC', email: `ari.${role}@example.test`, mobile: '077 123 4567', role, detailsConfirmed: true,
  documents: [{ kind: 'nic', name: 'Synthetic-NIC.pdf', sizeBytes: 1200, format: 'pdf', simulated: true }, ...(role === 'driver' ? [{ kind: 'driving-licence' as const, name: 'Synthetic-licence.pdf', sizeBytes: 1400, format: 'pdf' as const, simulated: true as const }] : [])],
})
const decision = (id: string, status: 'Approved' | 'Rejected' = 'Approved'): ApplicationDecisionInput => ({ applicationId: id, expectedRevision: 0, decision: status, reason: status === 'Rejected' ? 'Documents incomplete or unclear' : '', applicantMessage: '', note: '' })

test('Administrator queries list canonical people, separate companies, and filter by name/email/role/status', async () => {
  const { services, store } = setup()
  const workspace = await services.getAdminWorkspace(); assert.ok(workspace.ok)
  assert.equal(workspace.data.users.length, store.getState().data.users.length)
  assert.equal(workspace.data.companies.length, store.getState().data.customerCompanies.length)
  assert.equal(workspace.data.users.some(({ user }) => workspace.data.companies.some((company) => company.id === user.id)), false)
  const customer = workspace.data.users.find(({ user }) => user.id === 'user-customer')!
  assert.equal(customer.company?.id, customer.customer?.companyId)
  assert.deepEqual(filterAdminUsers(workspace.data.users, customer.user.email.toUpperCase(), 'customer', 'Active').map(({ user }) => user.id), ['user-customer'])
  assert.equal(filterAdminUsers(workspace.data.users, 'not-a-person', 'all', 'all').length, 0)
  assert.equal(filterAdminUsers(workspace.data.users, customer.user.name, 'driver', 'all').length, 0)
  const detail = await services.getAdminUser(customer.user.id); assert.ok(detail.ok); assert.equal(detail.data.company?.id, customer.company?.id)
  assert.equal((await services.getAdminUser('unknown')).ok, false)
  detail.data.user.name = 'Changed detached result'
  assert.notEqual(store.getState().data.users.find((user) => user.id === customer.user.id)?.name, detail.data.user.name)
})

test('all Administrator operations reject non-admin, logged-out, pending and switched sessions', async () => {
  const { store, services } = setup(5)
  const submitted = await services.submitStaffApplication(application()); assert.ok(submitted.ok)
  const id = submitted.data.applicationId
  const before = store.getState().data
  for (const sessionUserId of [null, 'user-customer', 'user-coordinator', 'user-driver-1', 'user-mechanic-1']) {
    store.setState({ sessionUserId })
    for (const result of await Promise.all([services.getAdminWorkspace(), services.getAdminUser('user-admin'), services.getAdminApplication(id), services.saveApplicationNote({ applicationId: id, expectedRevision: 0, note: 'Not authorized' }), services.decideStaffApplication(decision(id))])) assert.equal(result.ok, false)
  }
  store.setState({ sessionUserId: 'user-admin' })
  const delayed = services.decideStaffApplication(decision(id)); store.setState({ sessionUserId: 'user-customer' })
  assert.equal((await delayed).ok, false)
  assert.equal(store.getState().data, before)
  store.setState({ sessionUserId: 'user-admin', data: { ...before, users: before.users.map((user) => user.id === 'user-admin' ? { ...user, accountStatus: 'Pending' } : user) } })
  assert.equal((await services.getAdminWorkspace()).ok, false)
  assert.equal((await services.decideStaffApplication(decision(id))).ok, false)
  assert.equal((await unavailableAdapter.services.getAdminWorkspace()).ok, false)
  assert.equal((await unavailableAdapter.services.decideStaffApplication(decision(id))).ok, false)
})

test('Authentication staff submissions are immediately visible to Administrator review and counts', async () => {
  const { services, store } = setup()
  store.setState({ sessionUserId: null })
  const submitted = await services.submitStaffApplication(application()); assert.ok(submitted.ok)
  await services.signIn('admin')
  const view = await services.getAdminApplication(submitted.data.applicationId); assert.ok(view.ok)
  assert.equal(view.data.kind, 'Staff'); assert.equal(view.data.status, 'Pending'); assert.equal(view.data.staff?.documents.length, 2)
  const workspace = await services.getAdminWorkspace(); assert.ok(workspace.ok)
  assert.equal(workspace.data.applications.filter((item) => item.status === 'Pending').length, 1)
  assert.equal((await services.getAdminApplication('unknown')).ok, false)
})

test('approval provisions exactly the requested specialization, updates counts and preserves application/audit history', async () => {
  for (const role of ['driver', 'mechanic', 'coordinator'] as const) {
    const { store, services } = setup()
    const submitted = await services.submitStaffApplication(application(role)); assert.ok(submitted.ok)
    const before = store.getState().data
    const approved = await services.decideStaffApplication({ ...decision(submitted.data.applicationId), role: 'admin', actorId: 'user-customer' } as ApplicationDecisionInput); assert.ok(approved.ok)
    const data = store.getState().data
    const account = data.users.find((user) => user.id === approved.data.staff?.userId)!
    assert.equal(account.role, role); assert.equal(account.accountStatus, 'Active'); assert.equal(account.email, application(role).email)
    assert.equal(data.users.length, before.users.length + 1)
    assert.equal(data.drivers.filter((profile) => profile.userId === account.id).length, role === 'driver' ? 1 : 0)
    assert.equal(data.mechanics.filter((profile) => profile.userId === account.id).length, role === 'mechanic' ? 1 : 0)
    assert.equal(data.customers.some((profile) => profile.userId === account.id), false)
    assert.equal(data.staffApplications[0].reviewedBy, 'user-admin'); assert.ok(data.staffApplications[0].reviewedAt)
    assert.equal(data.auditEvents.filter((event) => event.actorId === 'user-admin' && [account.id, submitted.data.applicationId].includes(event.entityId)).length, 2)
    assert.equal(data.notifications.filter((item) => item.userId === account.id).length, 1)
    assert.ok(demoDatasetSchema.safeParse(data).success)
    const view = await services.getAdminWorkspace(); assert.ok(view.ok)
    assert.equal(view.data.applications.filter((item) => item.status === 'Pending').length, 0)
    assert.equal((await services.login({ email: account.email, password: DEMO_PASSWORD })).ok, role === 'coordinator')
    if (role === 'driver') assert.equal(data.drivers.find((profile) => profile.userId === account.id)?.available, false)
    if (role === 'mechanic') assert.equal(data.mechanics.find((profile) => profile.userId === account.id)?.available, false)
  }
})

test('rejection validates a reason, preserves details and creates no account or external-delivery claim', async () => {
  const { store, services } = setup()
  const submitted = await services.submitStaffApplication(application()); assert.ok(submitted.ok)
  const before = store.getState().data
  assert.equal((await services.decideStaffApplication({ ...decision(submitted.data.applicationId, 'Rejected'), reason: '   ' })).ok, false)
  assert.equal(store.getState().data, before)
  const result = await services.decideStaffApplication({ ...decision(submitted.data.applicationId, 'Rejected'), applicantMessage: 'Please correct the supplied details.', note: 'Reviewed metadata only.' }); assert.ok(result.ok)
  assert.equal(result.data.staff?.status, 'Rejected'); assert.ok(result.data.staff?.rejectionReason)
  assert.equal(result.data.staff?.applicantMessage, 'Please correct the supplied details.')
  assert.equal(store.getState().data.users.length, before.users.length)
  assert.equal(store.getState().data.notifications.length, before.notifications.length)
  assert.equal(store.getState().data.auditEvents.length, before.auditEvents.length + 1)
  assert.ok(demoDatasetSchema.safeParse(store.getState().data).success)
})

test('duplicate and concurrent conflicting decisions commit only one account, audit set and notification', async () => {
  const { store, services } = setup(5)
  const submitted = await services.submitStaffApplication(application()); assert.ok(submitted.ok)
  const results = await Promise.all([services.decideStaffApplication(decision(submitted.data.applicationId)), services.decideStaffApplication(decision(submitted.data.applicationId, 'Rejected')), services.decideStaffApplication(decision(submitted.data.applicationId))])
  assert.equal(results.filter((item) => item.ok).length, 1)
  const committed = store.getState().data
  assert.equal((await services.decideStaffApplication(decision(submitted.data.applicationId))).ok, false)
  assert.equal(store.getState().data, committed)
  assert.equal(committed.users.filter((user) => user.email === application().email).length, 1)
  assert.equal(committed.staffApplications.length, 1)
})

test('review notes increment the version, reject stale updates/decisions and retain admin audit records', async () => {
  const { services, store } = setup()
  const submitted = await services.submitStaffApplication(application()); assert.ok(submitted.ok)
  const id = submitted.data.applicationId
  assert.equal((await services.saveApplicationNote({ applicationId: id, expectedRevision: 0, note: 'x'.repeat(2001) })).ok, false)
  assert.ok((await services.saveApplicationNote({ applicationId: id, expectedRevision: 0, note: 'Review in progress.' })).ok)
  assert.equal((await services.saveApplicationNote({ applicationId: id, expectedRevision: 0, note: 'Stale edit' })).ok, false)
  assert.equal((await services.decideStaffApplication(decision(id))).ok, false)
  assert.ok((await services.decideStaffApplication({ ...decision(id), expectedRevision: 1, note: 'Review in progress.' })).ok)
  assert.equal(store.getState().data.staffApplications[0].internalNote, 'Review in progress.')
  assert.equal(store.getState().data.staffApplications[0].revision, 2)
  assert.equal((await services.saveApplicationNote({ applicationId: id, expectedRevision: 2, note: 'Cannot alter decided review' })).ok, false)
})

test('unknown applications, duplicate account emails and missing mandatory metadata cannot be approved', async () => {
  const { store, services } = setup()
  assert.equal((await services.decideStaffApplication(decision('unknown'))).ok, false)
  const submitted = await services.submitStaffApplication(application()); assert.ok(submitted.ok)
  const data = store.getState().data
  store.setState({ data: { ...data, staffApplications: data.staffApplications.map((item) => ({ ...item, email: data.users[0].email })) } })
  assert.equal((await services.decideStaffApplication(decision(submitted.data.applicationId))).ok, false)
  store.setState({ data: { ...data, staffApplications: data.staffApplications.map((item) => ({ ...item, documents: item.documents.filter((doc) => doc.kind !== 'driving-licence') })) } })
  assert.equal((await services.decideStaffApplication(decision(submitted.data.applicationId))).ok, false)
  assert.equal(store.getState().data.users.length, data.users.length)
})

test('notification preparation failure prevents partial approval; reload and reset preserve valid relationships', async () => {
  const { store, storage, services } = setup()
  const submitted = await services.submitStaffApplication(application()); assert.ok(submitted.ok)
  const before = store.getState().data
  const failing = createAdminServices(store, 0, { prepare: () => { throw new Error('Notification preparation failed') } })
  assert.equal((await failing.decideStaffApplication(decision(submitted.data.applicationId))).ok, false)
  assert.equal(store.getState().data, before)
  const result = await services.decideStaffApplication(decision(submitted.data.applicationId)); assert.ok(result.ok)
  const restored = createDemoStore(storage)
  assert.equal(restored.getState().storageNotice, null)
  assert.deepEqual(restored.getState().data.staffApplications, store.getState().data.staffApplications)
  assert.deepEqual(restored.getState().data.auditEvents, store.getState().data.auditEvents)
  await services.resetDemoData()
  assert.equal(store.getState().data.staffApplications.length, 0)
  assert.equal(store.getState().data.users.some((user) => user.email === application().email), false)
})

test('customer registration remains a linked person/company pending a separate approved policy', async () => {
  const { services, store } = setup()
  const submitted = await services.registerCustomer({ companyName: 'Test Logistics', businessRegistrationNumber: 'TEST-BR', billingAddress: 'Test address', fullName: 'Test Contact', mobile: '077 123 4567', email: 'contact@example.test', password: 'Synthetic123', confirmPassword: 'Synthetic123', termsAccepted: true }); assert.ok(submitted.ok)
  const result = await services.getAdminApplication(submitted.data.registrationId); assert.ok(result.ok)
  assert.equal(result.data.name, 'Test Contact'); assert.equal(result.data.company?.name, 'Test Logistics')
  assert.equal(result.data.kind, 'Customer'); assert.equal(result.data.staff, undefined)
  assert.equal((await services.decideStaffApplication(decision(submitted.data.registrationId))).ok, false)
  assert.equal(store.getState().data.users.find((user) => user.email === 'contact@example.test')?.accountStatus, 'Pending')
})

test('reset during a pending decision cannot resurrect removed application data; CSV export escapes values', async () => {
  const { store, services } = setup()
  const submitted = await services.submitStaffApplication(application()); assert.ok(submitted.ok)
  const delayed = createAdminServices(store, 10).decideStaffApplication(decision(submitted.data.applicationId))
  await services.resetDemoData()
  assert.equal((await delayed).ok, false)
  assert.equal(store.getState().data.staffApplications.length, 0)
  assert.equal(adminCsv([['Name', 'Email'], ['=DANGER', 'a"b\nc']]), '"Name","Email"\r\n"\'=DANGER","a""b\nc"')
})
