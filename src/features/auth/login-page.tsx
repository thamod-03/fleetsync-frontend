import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../../components/ui/button'
import { AuthBanner, AuthCheck, AuthField, AuthHeading, AuthSubmit } from './auth-components'
import { loginSchema, type LoginInput } from './auth-schemas'
import type { LoginResult } from '../../services/contracts'
import shield from '../../assets/auth/shield.svg'
import { applicationServices } from '../../services/application-services'
import { getLoginDestination } from '../../routes/access'

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [failure, setFailure] = useState<LoginResult | null>(null)
  const { register, handleSubmit, control, formState: { errors, isSubmitting }, resetField } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '', rememberSession: false },
  })
  const loading = isSubmitting
  const submit = async (values: LoginInput) => {
    const result = await applicationServices.login(values)
    if (result.ok) { resetField('password'); navigate(getLoginDestination(result.data.role, params.get('from')), { replace: true }) }
    else setFailure(result)
  }
  return <section className="auth-content">
    {!failure && <div className="auth-login-spacer" aria-hidden="true" />}
    <AuthHeading title="Sign in">Welcome back. Use the email registered with your account.</AuthHeading>
    {failure && !failure.ok && <AuthBanner tone="danger" title={failure.attemptsLeft !== undefined ? 'Incorrect email or password' : 'Unable to sign in'}>{failure.error}</AuthBanner>}
    <form className="auth-form" noValidate onSubmit={handleSubmit(submit)} aria-busy={loading}>
      <fieldset disabled={loading} className="auth-form">
        <AuthField label="Email address" registration={register('email')} type="email" autoComplete="username" placeholder="name@company.lk" error={errors.email?.message} />
        <AuthField label="Password" registration={register('password')} type="password" autoComplete="current-password" placeholder="••••••••••" error={errors.password?.message} invalid={Boolean(failure)}
          helper={failure?.attemptsLeft !== undefined ? `${failure.attemptsLeft} attempts left` : undefined} />
        <div className="auth-options"><Controller name="rememberSession" control={control} render={({ field }) => <AuthCheck id="remember-session" disabled={loading} checked={field.value ?? false} onChange={field.onChange}>Keep me signed in</AuthCheck>} />
          <Link className="auth-link" to="/forgot-password">Forgot password?</Link></div>
        <AuthSubmit busy={loading}>Sign in</AuthSubmit>
      </fieldset>
    </form>
    <div className="auth-divider">New here?</div>
    <div className="auth-row"><Button className="auth-button" variant="outline" render={<Link to="/register" />}>Register as customer</Button><Button className="auth-button" variant="outline" render={<Link to="/apply/staff" />}>Request staff account</Button></div>
    <p className="auth-footnote"><img src={shield} alt="" />You’ll see only the pages your role has access to.</p>
  </section>
}
