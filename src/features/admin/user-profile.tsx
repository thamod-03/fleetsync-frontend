import { adminDate } from './admin-format'
import { useState } from 'react'
import { applicationServices } from '../../services/application-services'
import { AdminAvatar, AdminDialog, AdminFacts, AdminStatus } from './admin-components'
import { adminRoleLabels } from '../../types/admin'
import type { AdminUser } from '../../types/admin'
import { userRoles } from '../../types/domain'

export function UserProfile({ data, onClose }: { data: AdminUser; onClose: () => void }) {
  const [activity, setActivity] = useState(false)
  const [changeRole, setChangeRole] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const { user } = data
  const reset = async () => {
    setBusy(true)
    try { const result = await applicationServices.requestPasswordReset({ email: user.email }); setNotice(result.ok ? result.data.message : result.error) }
    catch { setNotice('Unable to request a password reset. Please try again.') }
    finally { setBusy(false) }
  }
  return <><AdminDialog title="User profile" drawer onClose={onClose}><div className="admin-dialog-body"><div className="admin-profile-heading"><AdminAvatar name={user.name} /><div><h2>{user.name}</h2><span>{adminRoleLabels[user.role]} · </span><AdminStatus status={user.accountStatus ?? 'Active'} /><small className="block coord-mono mt-2">{user.id}</small></div></div><div className="coord-actions"><button className="coord-button secondary small" onClick={() => setChangeRole(true)}>Change role</button><button className="coord-button secondary small" disabled={busy} onClick={() => void reset()}>Reset password</button><button className="coord-button danger small" disabled title="Account deactivation and active-assignment handling require an approved policy">Deactivate</button></div>{notice && <p role="status" className="admin-notice">{notice}</p>}
    <nav className="coord-tabs" aria-label="User profile sections"><button className={!activity ? 'active' : ''} onClick={() => setActivity(false)}>Overview</button><button className={activity ? 'active' : ''} onClick={() => setActivity(true)}>Activity</button></nav>
    {!activity && <><h3 className="coord-field-label">CONTACT DETAILS</h3><AdminFacts values={[["Email", user.email], ['Phone', data.mobile], ['Customer company', data.company?.name]]} />{data.driver && <><h3 className="coord-field-label">DRIVER DETAILS</h3><AdminFacts values={[["Driver ID", data.driver.id], ['Licence class', data.driver.licence], ['Resource status', data.driver.available ? 'Available' : 'Reserved or unavailable']]} /></>}{data.mechanic && <><h3 className="coord-field-label">MECHANIC DETAILS</h3><AdminFacts values={[["Mechanic ID", data.mechanic.id], ['Speciality', data.mechanic.speciality], ['Workshop', data.mechanic.workshop], ['Resource status', data.mechanic.available ? 'Available' : 'Reserved or unavailable']]} /></>}{data.company && <><h3 className="coord-field-label">CUSTOMER COMPANY</h3><AdminFacts values={[["Company", data.company.name], ['Business registration', data.company.businessRegistrationNumber], ['Billing address', data.company.billingAddress]]} /></>}<h3 className="coord-field-label">ACCOUNT</h3><AdminFacts values={[["Joined", adminDate(data.joinedAt)], ['Last sign-in', 'Not recorded']]} /></>}
    <h3 className="coord-field-label">{activity ? 'ACTIVITY' : 'RECENT ACTIVITY'}</h3>{data.activity.length ? <ul className="admin-timeline">{data.activity.slice(0, activity ? undefined : 5).map((event) => <li key={event.id}>{event.action.replace(/^Demo /, '')}<time>{adminDate(event.createdAt)}</time></li>)}</ul> : <p>No recorded activity.</p>}</div><div className="admin-dialog-footer"><button className="coord-button secondary" onClick={onClose}>Close</button><button className="coord-button" disabled title="Account detail editing requires approved fields and validation rules">Edit details</button></div></AdminDialog>
    {changeRole && <AdminDialog title="Change role" description="Only Fleet Administrators can change a user’s role." onClose={() => setChangeRole(false)}><div className="admin-dialog-body"><div className="admin-person"><AdminAvatar name={user.name} /><div>{user.name}<small className="block">{user.email}</small></div></div><p>Current role: <strong>{adminRoleLabels[user.role]}</strong></p><fieldset className="admin-role-options"><legend className="mb-2">New role</legend>{userRoles.map((role) => <label key={role}><input type="radio" name="role" checked={role === user.role} disabled readOnly />{adminRoleLabels[role]}</label>)}</fieldset><label className="admin-form-field">Reason for change<textarea className="coord-input" disabled rows={2} /></label><p className="admin-notice">Role changes are unavailable until profile conversion and active-assignment rules are approved.</p></div><div className="admin-dialog-footer"><button className="coord-button secondary" onClick={() => setChangeRole(false)}>Cancel</button><button className="coord-button" disabled>Change role</button></div></AdminDialog>}
  </>
}
