import { adminDate } from './admin-format'
import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, CircleAlert, ChevronLeft } from 'lucide-react'
import { applicationServices } from '../../services/application-services'
import { LoadingState, ErrorState } from '../../components/ui/page-states'
import { useCoordinatorQuery } from '../coordinator/use-coordinator-query'
import { AdminAvatar, AdminCard, AdminFacts, AdminStatus } from './admin-components'
import { adminRoleLabels, applicationNoteSchema } from '../../types/admin'
import type { AdminApplication, ApplicationNoteInput } from '../../types/admin'
import { ApplicationDecisionDialog } from './application-decision-dialog'
import documentIcon from '../../assets/admin/document.svg'
import './admin.css'

export function AdminApplicationReviewPage() {
  const { applicationId = '' } = useParams()
  const query = useCallback(() => applicationServices.getAdminApplication(applicationId), [applicationId])
  const { result, retry } = useCoordinatorQuery(query)
  if (!result) return <div className="coord-page"><LoadingState label="Loading application…" /></div>
  if (!result.ok) return <div className="coord-page"><Link className="coord-link" to="/admin/applications">Back to applications</Link><ErrorState message={result.error} onRetry={retry} /></div>
  return <ApplicationReview key={applicationId} data={result.data} />
}
export function ApplicationReview({ data }: { data: AdminApplication }) {
  const [dialog, setDialog] = useState<{ decision: 'Approved' | 'Rejected'; application: AdminApplication } | null>(null)
  const [notice, setNotice] = useState(''); const [error, setError] = useState('')
  const [metadata, setMetadata] = useState<string | null>(null)
  const note = useForm<ApplicationNoteInput>({ resolver: zodResolver(applicationNoteSchema), defaultValues: { applicationId: data.id, expectedRevision: data.staff?.revision ?? 0, note: data.staff?.internalNote ?? '' } })
  const saveNote = note.handleSubmit(async (input) => {
    setError(''); setNotice('')
    try { const result = await applicationServices.saveApplicationNote(input); if (result.ok) { note.setValue('expectedRevision', input.expectedRevision + 1); setNotice('Review note saved.') } else setError(result.error) }
    catch { setError('Unable to save the review note. Please try again.') }
  })
  const pending = data.status === 'Pending'; const canDecide = pending && !!data.staff
  return <div className="coord-page"><nav className="coord-breadcrumb" aria-label="Breadcrumb"><Link to="/admin/applications"><ChevronLeft size={14} />Applications</Link><span>/</span><span className="coord-mono">{data.id}</span></nav><div className="coord-page-heading"><div className="admin-person"><AdminAvatar name={data.name} /><div><div className="coord-title-row"><h1>{data.name}</h1><AdminStatus status={data.status} /></div><p>{data.kind} account · Requested role: {adminRoleLabels[data.role]} · Submitted {adminDate(data.createdAt)}</p></div></div><div className="coord-actions">{pending && <><button className="coord-button danger" disabled={!canDecide || note.formState.isSubmitting} title={!canDecide ? 'Customer approval policy is awaiting confirmation' : undefined} onClick={() => setDialog({ decision: 'Rejected', application: { ...data, staff: data.staff ? { ...data.staff, revision: note.getValues('expectedRevision') } : undefined } })}>Reject</button><button className="coord-button" disabled={!canDecide || note.formState.isSubmitting} title={!canDecide ? 'Customer approval policy is awaiting confirmation' : undefined} onClick={() => setDialog({ decision: 'Approved', application: { ...data, staff: data.staff ? { ...data.staff, revision: note.getValues('expectedRevision') } : undefined } })}>Approve</button></>}</div></div>
    {notice && <p role="status" className="coord-confirmation">{notice}</p>}{error && <ErrorState message={error} />}{metadata && <p role="status" className="admin-notice">{metadata}</p>}
    <div className="admin-grid"><div className="admin-stack"><AdminCard title="Applicant details" subtitle="From the submitted application form"><div className="coord-card-body"><AdminFacts values={[["Full name", data.name], ['NIC number', data.staff?.nicNumber], ['Email', data.email], ['Mobile', data.mobile], ['Date applied', adminDate(data.createdAt)], ...(data.company ? [['Customer company', data.company.name], ['Business registration', data.company.businessRegistrationNumber], ['Billing address', data.company.billingAddress]] as [string, string | undefined][] : [])]} /></div></AdminCard>
    <AdminCard title={data.role === 'driver' ? 'Role & licence' : 'Requested role'}><div className="coord-card-body"><AdminFacts values={[["Requested role", adminRoleLabels[data.role]], ['Depot', 'Not configured'], ...(data.role === 'driver' ? [['Licence number', 'Not recorded by current application form'], ['Licence class / expiry', 'Not recorded']] as [string, string][] : [])]} /></div></AdminCard>
    <AdminCard title="Documents" subtitle={data.staff ? `${data.staff.documents.length} document metadata records` : 'No documents required by the current customer form'}><div className="coord-card-body">{data.staff?.documents.map((document) => <div className="admin-document" key={document.kind}><img src={documentIcon} alt="" /><div>{document.name}<small>{document.format.toUpperCase()} · {(document.sizeBytes / 1024).toFixed(1)} KB</small></div><AdminStatus status="Not checked" /><button className="coord-button secondary small" onClick={() => setMetadata(`${document.name}: only filename, type and size were stored. Document content is unavailable; it has not been inspected or verified.`)}>View</button></div>)}{data.staff?.documents.length === 0 && <p>No document metadata recorded.</p>}</div></AdminCard>
    {!pending && <AdminCard title="Decision"><div className="coord-card-body"><AdminFacts values={[["Status", data.status], ['Decision date', adminDate(data.staff?.reviewedAt)], ['Reason', data.staff?.rejectionReason], ['Message to applicant', data.staff?.applicantMessage]]} />{data.staff?.userId && <Link className="coord-link" to={`/admin/users/${data.staff.userId}`}>View created account</Link>}</div></AdminCard>}
    </div><div className="admin-stack"><AdminCard title="Automatic checks" subtitle="Available checks against current records"><ul className="admin-checks"><li><CheckCircle2 size={16} className="text-green-700" />Application details stored</li><li><CircleAlert size={16} className="text-amber-700" />Email and mobile verification not connected</li>{data.role === 'driver' && <li><CircleAlert size={16} className="text-amber-700" />Licence validity has not been verified</li>}<li><CircleAlert size={16} className="text-amber-700" />Document contents unavailable for verification</li></ul></AdminCard><AdminCard title="Timeline"><ul className="admin-timeline">{data.activity.map((event) => <li key={event.id}>{event.action}<time>{adminDate(event.createdAt)}</time></li>)}<li>Application submitted<time>{adminDate(data.createdAt)}</time></li></ul></AdminCard><AdminCard title="Internal note" subtitle="Only administrators can see this"><form className="coord-card-body" onSubmit={saveNote} noValidate><label className="sr-only" htmlFor="admin-review-note">Internal review note</label><textarea id="admin-review-note" className="coord-input" placeholder="Add a note for other admins…" rows={4} maxLength={2000} {...note.register('note')} disabled={!canDecide || note.formState.isSubmitting} aria-invalid={!!note.formState.errors.note} aria-describedby={note.formState.errors.note ? 'admin-note-error' : undefined} />{note.formState.errors.note && <p className="coord-field-error" role="alert" id="admin-note-error">{note.formState.errors.note.message}</p>}<button className="coord-button secondary small" disabled={!canDecide || note.formState.isSubmitting}>{note.formState.isSubmitting ? 'Saving…' : 'Save note'}</button></form></AdminCard></div></div>
    {dialog && <ApplicationDecisionDialog application={dialog.application} decision={dialog.decision} note={note.getValues('note')} onClose={() => setDialog(null)} onSaved={(application) => { setDialog(null); setNotice(application.status === 'Approved' ? 'Application approved and account created. No setup email was sent.' : 'Application rejected. No email was sent.') }} />}
  </div>
}
