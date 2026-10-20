import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { applicationServices } from '../../services/application-services'
import { passwordResetSchema, type PasswordResetInput } from './auth-schemas'
import { AuthBanner, AuthField, AuthHeading, AuthSubmit, BackToLogin } from './auth-components'
import lock from '../../assets/auth/lock.svg'
import check from '../../assets/auth/password-check.svg'
import note from '../../assets/auth/note.svg'

export function ResetPasswordPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updated, setUpdated] = useState(false)
  const { email } = applicationServices.getResetContext()
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<PasswordResetInput>({ resolver: zodResolver(passwordResetSchema), defaultValues: { password: '', confirmPassword: '' } })
  const password = useWatch({ control, name: 'password' })
  const requirements = [
    { text: 'At least 8 characters', met: password.length >= 8 && password.length <= 128 },
    { text: 'One uppercase and one lowercase letter', met: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { text: 'At least one number', met: /[0-9]/.test(password) },
    { text: 'Not the same as your last password', met: false },
  ]
  const strength = requirements.filter((item) => item.met).length
  const submit = async (values: PasswordResetInput) => {
    setError(null)
    const result = await applicationServices.resetPassword(values)
    if (result.ok) { setMessage(result.data.message); setUpdated(result.data.updated); reset() } else setError(result.error)
  }
  return <section className="auth-content"><div className="auth-icon-circle"><img src={lock} alt="" /></div>
    <AuthHeading title="Set a new password">{email ? `For ${email}` : undefined}</AuthHeading>
    {message ? <><AuthBanner tone={updated ? 'success' : 'info'} title={updated ? 'Password updated' : 'Password update unavailable'}>{message}</AuthBanner><BackToLogin /></> : <>
      {error && <AuthBanner tone="danger" title="Check your password">{error}</AuthBanner>}
      <form className="auth-form" noValidate onSubmit={handleSubmit(submit)} aria-busy={isSubmitting}><fieldset disabled={isSubmitting} className="auth-form">
        <AuthField label="New password" registration={register('password')} type="password" autoComplete="new-password" error={errors.password?.message} />
        <div><div className="auth-password-meter" aria-hidden="true">{requirements.map((item, index) => <span key={item.text} data-met={index < strength} />)}</div>
          <p className="auth-helper auth-password-strength" data-strong={strength === 3} role="status">{password ? strength === 3 ? 'Strong password' : 'Keep strengthening your password' : 'Enter a new password'}</p>
        </div>
        <ul className="auth-password-checks">{requirements.map((item) => <li key={item.text} data-met={item.met}><img src={check} alt={item.met ? 'Met:' : 'Not met:'} />{item.text}</li>)}</ul>
        <AuthField label="Confirm new password" registration={register('confirmPassword')} type="password" autoComplete="new-password" error={errors.confirmPassword?.message} />
        <AuthSubmit busy={isSubmitting}>Update password</AuthSubmit>
      </fieldset></form>
      <p className="auth-footnote"><img src={note} alt="" />You’ll be signed out of other devices after the change.</p>
    </>}
  </section>
}
