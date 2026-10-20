import { useId, useRef, useState } from 'react'
import { applicationServices } from '../../services/application-services'
import type { UploadFile } from '../../services/contracts'
import type { DemoDocument, StaffApplicationInput } from './auth-schemas'
import uploadIcon from '../../assets/auth/upload.svg'
import fileIcon from '../../assets/auth/file.svg'
import closeIcon from '../../assets/auth/close.svg'

export function DocumentPicker({ role, documents, onChange, error, disabled }: {
  role: StaffApplicationInput['role']; documents: DemoDocument[]; onChange: (documents: DemoDocument[]) => void; error?: string; disabled: boolean;
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const addFiles = async (files: readonly UploadFile[]) => {
    if (disabled || busy || !files.length) return
    setNotice('')
    setBusy(true)
    const result = await applicationServices.prepareDocuments(files)
    if (!result.ok) setNotice(result.error)
    else if (documents.length + result.data.length > 2 || result.data.some((next) => documents.some((existing) => existing.kind === next.kind)) || new Set(result.data.map((item) => item.kind)).size !== result.data.length) {
      setNotice('Add one NIC copy and, for drivers, one driving licence.')
    } else onChange([...documents, ...result.data])
    setBusy(false)
  }
  const metadata = (files: FileList | null) => Array.from(files ?? []).map((file) => ({ name: file.name, size: file.size, type: file.type }))
  const sizeLabel = (size: number) => size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`
  return <div className="auth-form" aria-busy={busy}>
    <div className="auth-upload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(metadata(event.dataTransfer.files)) }}>
      <img src={uploadIcon} alt="" /><p>Drop files here or <button type="button" disabled={disabled || busy} className="auth-link" onClick={() => input.current?.click()} aria-controls={id}>browse</button></p>
      <input ref={input} id={id} className="sr-only" tabIndex={-1} type="file" multiple accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg" disabled={disabled || busy} aria-label="Upload documents" onChange={(event) => { void addFiles(metadata(event.target.files)); event.target.value = '' }} />
      <p className="auth-helper">{role === 'driver' ? 'NIC copy and driving licence' : 'NIC copy'} · PDF or JPG · up to 5 MB each</p>
    </div>
    {(notice || error) && <p id="documents-error" role="alert" className="auth-field-error">{notice || error}</p>}
    {documents.map((document) => <div className="auth-document" key={document.kind}><img src={fileIcon} alt="" /><span className="auth-document-name">{document.name}</span><span className="auth-helper">{sizeLabel(document.sizeBytes)}</span><button type="button" disabled={disabled || busy} aria-label={`Remove ${document.name}`} onClick={() => onChange(documents.filter((item) => item.kind !== document.kind))}><img src={closeIcon} alt="" /></button></div>)}
  </div>
}
