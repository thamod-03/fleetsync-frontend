import type { ReactNode, HTMLInputAutoCompleteAttribute } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { Input } from '@base-ui/react/input'
import { Checkbox } from '@base-ui/react/checkbox'
import { Dialog } from '@base-ui/react/dialog'
import { Link } from 'react-router'
import { Button } from '../../components/ui/button'
import errorIcon from '../../assets/auth/error.svg'
import successIcon from '../../assets/auth/success.svg'
import infoIcon from '../../assets/auth/info.svg'
import fieldErrorIcon from '../../assets/auth/field-error.svg'
import backIcon from '../../assets/auth/back.svg'
import checkIcon from '../../assets/auth/checkbox-check.svg'

export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="auth-heading"><h1>{title}</h1>{children && <p>{children}</p>}</div>
}
export function AuthField({ label, registration, type = 'text', error, helper, placeholder, autoComplete, invalid }: {
  label: string; registration: UseFormRegisterReturn; type?: string; error?: string; helper?: string; placeholder?: string;
  autoComplete?: HTMLInputAutoCompleteAttribute; invalid?: boolean;
}) {
  const id = `auth-${registration.name}`
  return <div className="auth-field"><label htmlFor={id}>{label}</label>
    <Input {...registration} id={id} type={type} className="auth-input" placeholder={placeholder} autoComplete={autoComplete}
      aria-required="true" aria-invalid={Boolean(error || invalid)} aria-describedby={error ? `${id}-error` : helper ? `${id}-help` : undefined} />
    {error ? <p id={`${id}-error`} className="auth-field-error"><img src={fieldErrorIcon} alt="" />{error}</p> : helper && <p id={`${id}-help`} className="auth-helper">{helper}</p>}
  </div>
}
export function AuthCheck({ id, checked, onChange, children, error, disabled }: {
  id: string; checked: boolean; onChange: (checked: boolean) => void; children: ReactNode; error?: string; disabled?: boolean;
}) {
  return <div className="auth-field"><div className="auth-check-label">
    <Checkbox.Root id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} className="auth-checkbox" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}>
      <Checkbox.Indicator><img src={checkIcon} alt="" /></Checkbox.Indicator>
    </Checkbox.Root><label htmlFor={id}>{children}</label>
  </div>{error && <p className="auth-field-error" id={`${id}-error`}>{error}</p>}</div>
}
export function AuthBanner({ tone, title, children }: { tone: 'danger' | 'success' | 'info'; title: string; children: ReactNode }) {
  return <div className={`auth-banner auth-banner-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
    <img src={tone === 'danger' ? errorIcon : tone === 'success' ? successIcon : infoIcon} alt="" />
    <div><strong>{title}</strong>{children}</div>
  </div>
}
export function BackToLogin() { return <Link className="auth-link auth-back" to="/login"><img src={backIcon} alt="" />Back to sign in</Link> }
export function AuthSubmit({ busy, children, disabled }: { busy: boolean; children: ReactNode; disabled?: boolean }) {
  return <Button className="auth-button auth-submit" type="submit" disabled={busy || disabled}>{busy ? 'Please wait…' : children}</Button>
}
export function SignInLink() { return <p className="auth-helper">Already have an account? <Link className="auth-link" to="/login">Sign in</Link></p> }
export function TermsOfService() {
  return <Dialog.Root><Dialog.Trigger className="auth-link" type="button">terms of service</Dialog.Trigger>
    <Dialog.Portal><Dialog.Backdrop className="auth-dialog-backdrop" /><Dialog.Popup className="auth-dialog">
      <Dialog.Title className="text-lg font-semibold">Terms of service</Dialog.Title>
      <Dialog.Description className="text-sm leading-6">The terms of service could not be loaded. Please try again later or contact your Fleet Administrator.</Dialog.Description>
      <Dialog.Close render={<Button variant="outline" />}>Close</Dialog.Close>
    </Dialog.Popup></Dialog.Portal>
  </Dialog.Root>
}
