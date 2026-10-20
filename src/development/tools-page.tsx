import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '../components/ui/button'
import { mockServices } from '../data/mock-services'
import { DEMO_PASSWORD } from '../data/auth-services'
import { demoStore } from '../store/demo-store'
import { roleHome, roleLabels } from '../routes/navigation'
import { webRoles, type WebRole } from '../types/domain'
import { demoDocuments } from '../data/demo-documents'

// This entire route/module is removed from production builds.
export function Component() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const switchPersona = async (role: WebRole) => {
    setBusy(true)
    const result = await mockServices.signIn(role)
    if (result.ok) navigate(roleHome[role])
    else setMessage(result.error)
    setBusy(false)
  }
  return <main className="mx-auto max-w-xl space-y-5 p-8"><h1 className="text-2xl font-semibold">Development utilities</h1>
    <p>Local mock adapters are active. These controls and credentials are excluded from production builds. Do not use real personal data or identity documents.</p>
    <p>Public fixture password: <code>{DEMO_PASSWORD}</code></p>
    {webRoles.map((role) => <div className="space-y-2" key={role}><p>{demoStore.getState().data.users.find((user) => user.role === role && user.accountStatus !== 'Pending')?.email}</p><Button disabled={busy} onClick={() => void switchPersona(role)}>Continue as {roleLabels[role]}</Button></div>)}
    <Button variant="outline" disabled={busy} onClick={async () => { setBusy(true); await mockServices.resetDemoData(); setMessage('Seed data restored.'); setBusy(false) }}>Reset Demo Data</Button>
    <p role="status">{message}</p>
    <p><Link className="underline" to="/reset-password">Open password-reset flow</Link> · <Link className="underline" to="/login">Sign in</Link></p>
    <p>For the upload flow, use synthetic fixture files with these names. Only filename, type, and size are retained; file contents are never read.</p>
    {demoDocuments.map((document) => <p key={document.kind}><a className="underline" download={document.name.replace('DEMO-', '')} href={`data:${document.format === 'pdf' ? 'application/pdf' : 'image/jpeg'};charset=utf-8,Fixture%20metadata%20only`}>Download {document.kind} fixture</a></p>)}
  </main>
}
