import type { ReactNode } from 'react'


export function StatusBadge({ children }: { children: string }) {
  const tone = ['Paid', 'Completed', 'Available', 'Trip created'].includes(children) ? 'success' : ['Declined', 'Payment failed'].includes(children) ? 'danger' : ['Quoted', 'Assigned'].includes(children) ? 'accent' : ['In Progress', 'Accepted'].includes(children) ? 'info' : ['Not due yet', 'Draft'].includes(children) ? 'neutral' : 'pending'
  return <span className={`coord-badge coord-badge-${tone}`}>{children}</span>
}
export function CoordinatorCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return <section className="coord-card"><div className="coord-card-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>
}

