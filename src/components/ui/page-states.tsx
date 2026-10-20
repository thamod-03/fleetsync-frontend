import type { ReactNode } from 'react'
import { Inbox, CircleAlert } from 'lucide-react'
import { Button } from './button'

export function LoadingState({ label = 'Loading demo data…' }: { label?: string }) {
  return <div role="status" aria-live="polite" className="space-y-4 rounded-xl border bg-card p-6">
    <span className="text-sm text-muted-foreground">{label}</span>
    <div aria-hidden="true" className="grid gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((key) => <div key={key} className="h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />)}
    </div>
  </div>
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <section className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center">
    <Inbox aria-hidden="true" className="size-8 text-muted-foreground" />
    <h2 className="text-base font-semibold">{title}</h2>
    <p className="max-w-lg text-sm text-muted-foreground">{description}</p>
    {action}
  </section>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-card p-5">
    <CircleAlert aria-hidden="true" className="size-5 text-destructive" />
    <p className="flex-1 text-sm">{message}</p>
    {onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}
  </div>
}
