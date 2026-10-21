import { useState } from 'react'
import { applicationServices } from '../../services/application-services'

export function InvoiceDownload({ paymentId, label = 'Download invoice (PDF)', className = 'coord-button' }: { paymentId: string; label?: string; className?: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const download = async () => {
    setBusy(true); setError('')
    try {
      const result = await applicationServices.downloadCustomerInvoice(paymentId)
      if (!result.ok) { setError(result.error); return }
      const url = URL.createObjectURL(new Blob([result.data.bytes], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url; link.download = result.data.filename; document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError('Unable to download the invoice. Please try again.') }
    finally { setBusy(false) }
  }
  return <><button type="button" className={className} disabled={busy} onClick={() => void download()}>{busy ? 'Preparing PDF…' : label}</button>{error && <p role="alert" className="coord-field-error">{error}</p>}</>
}
