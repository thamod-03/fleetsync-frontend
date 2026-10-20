import type { ReactNode } from 'react'

export function PageContainer({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 sm:p-7">
    <div><h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{title}</h1>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
    </div>
    {children}
  </div>
}
