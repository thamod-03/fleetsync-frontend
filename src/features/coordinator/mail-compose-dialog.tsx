import { useState } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { composeMailSchema, type ComposeMailInput } from '../../types/communications'
import type { User } from '../../types/domain'
import { applicationServices } from '../../services/application-services'
import { ErrorState } from '../../components/ui/page-states'

export function MailComposeDialog({ initial, users, onClose, onSaved }: { initial: ComposeMailInput; users: User[]; onClose: () => void; onSaved: (draft: boolean) => void }) {
  const form = useForm<ComposeMailInput>({ resolver: zodResolver(composeMailSchema), defaultValues: initial })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async (input: ComposeMailInput, draft: boolean) => {
    setBusy(true); setError('')
    try { const result = await applicationServices.saveMail(input, draft); if (result.ok) onSaved(draft); else setError(result.error) }
    catch { setError('Unable to store the message. Please try again.') }
    finally { setBusy(false) }
  }
  return <Dialog.Root open onOpenChange={(open) => { if (!open && !busy) onClose() }}><Dialog.Portal><Dialog.Backdrop className="coord-dialog-backdrop" /><Dialog.Popup className="coord-lifecycle-dialog coordinator-shell mail-compose-dialog"><form noValidate onSubmit={form.handleSubmit((input) => save(input, false))}>
    <div className="coord-dialog-heading"><div><Dialog.Title>Compose mail</Dialog.Title><Dialog.Description>Write to the Fleet Administrator or another coordinator.</Dialog.Description></div></div>
    <div className="coord-dialog-body">{error && <ErrorState message={error} />}<fieldset disabled={busy} className="coord-dialog-fields">
      <label className="coord-form-field"><span>To</span><select multiple className="coord-input mail-recipient-select" {...form.register('recipientIds')} aria-invalid={!!form.formState.errors.recipientIds} aria-describedby="mail-recipient-error">{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.role === 'admin' ? 'Fleet Administrator' : 'Operational Coordinator'}</option>)}</select><small>Choose one or more recipients.</small>{form.formState.errors.recipientIds && <span className="coord-field-error" id="mail-recipient-error">{form.formState.errors.recipientIds.message}</span>}</label>
      <label className="coord-form-field"><span>Subject</span><input className="coord-input" {...form.register('subject')} maxLength={200} aria-invalid={!!form.formState.errors.subject} aria-describedby="mail-subject-error" />{form.formState.errors.subject && <span className="coord-field-error" id="mail-subject-error">{form.formState.errors.subject.message}</span>}</label>
      <label className="coord-form-field"><span>Message</span><textarea className="coord-input" rows={9} {...form.register('body')} maxLength={20000} aria-invalid={!!form.formState.errors.body} aria-describedby="mail-body-error" />{form.formState.errors.body && <span className="coord-field-error" id="mail-body-error">{form.formState.errors.body.message}</span>}</label>
    </fieldset></div>
    <div className="coord-dialog-footer"><button className="coord-button secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="coord-button secondary" type="button" disabled={busy} onClick={() => void save(form.getValues(), true)}>Save draft</button><button className="coord-button" disabled={busy}>{busy ? 'Saving…' : 'Send'}</button></div>
  </form></Dialog.Popup></Dialog.Portal></Dialog.Root>
}
