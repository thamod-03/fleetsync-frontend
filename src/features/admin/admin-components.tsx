import type { ReactNode } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { CoordinatorCard } from '../coordinator/coordinator-components'
export { CoordinatorCard as AdminCard }

export function AdminStatus({ status }: { status: string }) {
  return <span className={`admin-status ${status === 'Active' || status === 'Approved' ? 'success' : status === 'Rejected' ? 'danger' : 'pending'}`}>{status === 'Pending' ? 'Pending review' : status}</span>
}
export function AdminAvatar({ name }: { name: string }) { return <span className="admin-avatar" aria-hidden="true">{name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span> }
export function AdminFacts({ values }: { values: [string, ReactNode][] }) {
  return <dl className="admin-facts">{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not recorded'}</dd></div>)}</dl>
}
export function AdminDialog({ title, description, children, onClose, drawer = false, busy = false }: { title: string; description?: string; children: ReactNode; onClose: () => void; drawer?: boolean; busy?: boolean }) {
  return <Dialog.Root open onOpenChange={(open) => { if (!open && !busy) onClose() }}><Dialog.Portal><Dialog.Backdrop className="coord-dialog-backdrop" /><Dialog.Popup className={`coordinator-shell admin-shell admin-dialog ${drawer ? 'admin-drawer' : ''}`}>
    <div className="admin-dialog-title"><div><Dialog.Title>{title}</Dialog.Title>{description && <Dialog.Description>{description}</Dialog.Description>}</div><button type="button" aria-label="Close" disabled={busy} onClick={onClose}><X size={18} /></button></div>{children}
  </Dialog.Popup></Dialog.Portal></Dialog.Root>
}
export function AdminPagination({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / 8))
  return <div className="admin-pagination"><span>Rows per page: 8 · {total} records</span><button className="coord-button secondary small" disabled={!page} onClick={() => onChange(page - 1)}>Previous</button><span>Page {page + 1} of {pages}</span><button className="coord-button secondary small" disabled={page + 1 >= pages} onClick={() => onChange(page + 1)}>Next</button></div>
}
