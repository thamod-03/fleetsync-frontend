import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { applicationServices } from '../../services/application-services'
import { recoverySchema, type RecoveryInput } from './auth-schemas'
import { AuthBanner, AuthField, AuthHeading, AuthSubmit, BackToLogin } from './auth-components'
import keyIcon from '../../assets/auth/key.svg'

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [delivery, setDelivery] = useState<{ delivered: boolean; message: string } | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RecoveryInput>({ resolver: zodResolver(recoverySchema), defaultValues: { email: '' } })
  useEffect(() => {
    if (cooldown <= 0) return
    const timeout = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timeout)
  }, [cooldown])
  const submit = async (values: RecoveryInput) => {
    if (cooldown > 0) return
    setError(null)
    const result = await applicationServices.requestPasswordReset(values)
    if (result.ok) { setSent(true); setDelivery(result.data); setCooldown(45) } else setError(result.error)
  }
  return <section className="auth-content"><BackToLogin /><div className="auth-icon-circle"><img src={keyIcon} alt="" /></div>
    <AuthHeading title="Forgot your password?">Enter the email you sign in with. We’ll send a link to set a new password.</AuthHeading>
    {error && <AuthBanner tone="danger" title="Request could not be completed">{error}</AuthBanner>}
    <form className="auth-form" noValidate onSubmit={handleSubmit(submit)} aria-busy={isSubmitting}>
      <fieldset disabled={isSubmitting} className="auth-form"><AuthField label="Email address" registration={register('email')} type="email" autoComplete="email" error={errors.email?.message} />
        <AuthSubmit busy={isSubmitting} disabled={cooldown > 0}>Send reset link</AuthSubmit>
      </fieldset>
    </form>
    {sent && delivery && <><AuthBanner tone={delivery.delivered ? 'success' : 'info'} title={delivery.delivered ? 'Check your email' : 'Email delivery unavailable'}>{delivery.message}</AuthBanner>
      <p className="auth-helper">Didn’t get it? <button type="button" className="auth-link" disabled={cooldown > 0 || isSubmitting} onClick={() => void handleSubmit(submit)()}>{cooldown > 0 ? `Send again in 0:${String(cooldown).padStart(2, '0')}` : 'Send again'}</button></p>
      </>}
  </section>
}
