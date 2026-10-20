import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { applicationServices } from '../../services/application-services'
import { staffApplicationSchema, staffRoles, type StaffApplicationInput } from './auth-schemas'
import { AuthBanner, AuthCheck, AuthField, AuthHeading, AuthSubmit, BackToLogin, SignInLink } from './auth-components'
import { DocumentPicker } from './document-picker'

const labels = { driver: 'Driver', mechanic: 'Mechanic', coordinator: 'Operational Coordinator' }

export function StaffApplicationPage({ invitation }: { invitation?: { reference: string; expiresAt: string } } = {}) {
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, control, setValue, reset, formState: { errors, isSubmitting } } = useForm<StaffApplicationInput>({
    resolver: zodResolver(staffApplicationSchema), defaultValues: { fullName: '', nicNumber: '', email: '', mobile: '', role: 'driver', documents: [], detailsConfirmed: false },
  })
  const role = useWatch({ control, name: 'role' })
  const submit = async (values: StaffApplicationInput) => {
    setError(null)
    const result = await applicationServices.submitStaffApplication(values)
    if (result.ok) { setSuccess(result.data.applicationId); reset() } else setError(result.error)
  }
  const roleRegistration = register('role')
  const invitationDate = invitation ? new Date(invitation.expiresAt) : null
  return <section className="auth-content auth-content-wide">
    <AuthHeading title="Apply for a staff account">For drivers, mechanics and office staff. A Fleet Administrator reviews every application before an account is created.</AuthHeading>
    {success ? <><AuthBanner tone="success" title="Application submitted">Your application is pending review by the Fleet Administrator.</AuthBanner><p className="auth-helper break-all">Reference: {success}</p><BackToLogin /></> : <>
      {invitation?.reference && invitationDate && Number.isFinite(invitationDate.getTime()) && <AuthBanner tone="info" title={`Application form ${invitation.reference}`}>This form was generated for you by the Fleet Administrator. It expires on {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(invitationDate)}.</AuthBanner>}
      {error && <AuthBanner tone="danger" title="Application could not be saved">{error}</AuthBanner>}
      <form className="auth-form" noValidate onSubmit={handleSubmit(submit)} aria-busy={isSubmitting}><fieldset disabled={isSubmitting} className="auth-form">
        <h2 className="auth-section-label">YOUR DETAILS</h2>
        <div className="auth-row"><AuthField label="Full name" registration={register('fullName')} autoComplete="name" error={errors.fullName?.message} /><AuthField label="NIC number" registration={register('nicNumber')} autoComplete="off" error={errors.nicNumber?.message} /></div>
        <div className="auth-row"><AuthField label="Email" registration={register('email')} type="email" autoComplete="email" error={errors.email?.message} /><AuthField label="Mobile" registration={register('mobile')} type="tel" autoComplete="tel" error={errors.mobile?.message} /></div>
        <div className="auth-field"><label htmlFor="staff-role">Role you’re applying for</label><select {...roleRegistration} id="staff-role" className="auth-input auth-select" aria-invalid={Boolean(errors.role)} onChange={(event) => { void roleRegistration.onChange(event); setValue('documents', [], { shouldValidate: false }) }}>{staffRoles.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select>{errors.role && <p className="auth-field-error">{errors.role.message}</p>}</div>
        <h2 className="auth-section-label">DOCUMENTS</h2>
        <Controller name="documents" control={control} render={({ field }) => <DocumentPicker role={role} documents={field.value} onChange={field.onChange} error={errors.documents?.message} disabled={isSubmitting} />} />
        <Controller name="detailsConfirmed" control={control} render={({ field }) => <AuthCheck id="details-confirmed" disabled={isSubmitting} checked={field.value} onChange={field.onChange} error={errors.detailsConfirmed?.message}>The details I’ve given are correct</AuthCheck>} />
        <AuthSubmit busy={isSubmitting}>Submit application</AuthSubmit>
      </fieldset></form><SignInLink />
    </>}
  </section>
}
