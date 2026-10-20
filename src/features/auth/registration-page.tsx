import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { applicationServices } from '../../services/application-services'
import { registrationSchema, type RegistrationInput } from './auth-schemas'
import { AuthBanner, AuthCheck, AuthField, AuthHeading, AuthSubmit, BackToLogin, TermsOfService, SignInLink } from './auth-components'

export function RegistrationPage() {
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema), defaultValues: { companyName: '', businessRegistrationNumber: '', billingAddress: '', fullName: '', mobile: '', email: '', password: '', confirmPassword: '', termsAccepted: false },
  })
  const submit = async (values: RegistrationInput) => {
    setError(null)
    const result = await applicationServices.registerCustomer(values)
    if (result.ok) { setSuccess(result.data.registrationId); reset() } else setError(result.error)
  }
  return <section className="auth-content auth-content-wide">
    <AuthHeading title="Create a customer account">Register your company to place transport orders, get fare quotations and pay online.</AuthHeading>
    {success ? <><AuthBanner tone="success" title="Registration submitted">Your registration is pending review.</AuthBanner><p className="auth-helper break-all">Reference: {success}</p><BackToLogin /></> : <>
      {error && <AuthBanner tone="danger" title="Registration could not be saved">{error}</AuthBanner>}
      <form className="auth-form" noValidate onSubmit={handleSubmit(submit)} aria-busy={isSubmitting}><fieldset disabled={isSubmitting} className="auth-form">
        <h2 className="auth-section-label">COMPANY</h2>
        <div className="auth-row"><AuthField label="Company name" registration={register('companyName')} autoComplete="organization" error={errors.companyName?.message} /><AuthField label="Business registration no." registration={register('businessRegistrationNumber')} autoComplete="off" error={errors.businessRegistrationNumber?.message} /></div>
        <AuthField label="Billing address" registration={register('billingAddress')} autoComplete="street-address" error={errors.billingAddress?.message} />
        <h2 className="auth-section-label">CONTACT PERSON</h2>
        <div className="auth-row"><AuthField label="Full name" registration={register('fullName')} autoComplete="name" error={errors.fullName?.message} /><AuthField label="Mobile" registration={register('mobile')} type="tel" autoComplete="tel" error={errors.mobile?.message} /></div>
        <AuthField label="Work email" registration={register('email')} type="email" autoComplete="email" helper="You’ll sign in with this email" error={errors.email?.message} />
        <div className="auth-row"><AuthField label="Password" registration={register('password')} type="password" autoComplete="new-password" error={errors.password?.message} /><AuthField label="Confirm password" registration={register('confirmPassword')} type="password" autoComplete="new-password" error={errors.confirmPassword?.message} /></div>
        <Controller name="termsAccepted" control={control} render={({ field }) => <AuthCheck id="terms-accepted" disabled={isSubmitting} checked={field.value} onChange={field.onChange} error={errors.termsAccepted?.message}>I agree to the <TermsOfService /></AuthCheck>} />
        <AuthSubmit busy={isSubmitting}>Create account</AuthSubmit>
      </fieldset></form><SignInLink />
    </>}
  </section>
}
