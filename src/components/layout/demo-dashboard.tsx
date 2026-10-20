import { useEffect, useState } from 'react'
import { applicationServices } from '../../services/application-services'
import { useApplicationRevision, useDemoUser } from '../../hooks/use-demo'
import { EmptyState, ErrorState, LoadingState } from '../ui/page-states'
import { PageContainer } from './page-container'

type DashboardResult = Awaited<ReturnType<typeof applicationServices.getDashboard>>
export function DemoDashboard({ title }: { title: string }) {
  const user = useDemoUser()
  const revision = useApplicationRevision()
  const [result, setResult] = useState<DashboardResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void applicationServices.getDashboard().then((value) => { if (active) setResult(value) })
    return () => { active = false }
  }, [revision, user?.id, attempt])
  return <PageContainer title={title} description="Shared architecture preview · Final dashboard screens will follow the approved Figma frames.">
    {!result ? <LoadingState /> : !result.ok ? <ErrorState message={result.error} onRetry={() => setAttempt((value) => value + 1)} /> :
      <dl className="grid grid-cols-2 gap-4 xl:grid-cols-4">{Object.entries(result.data).map(([label, value]) => <div className="rounded-xl border bg-card p-5" key={label}><dt className="text-sm capitalize text-muted-foreground">{label === 'notifications' ? 'Unread notifications' : label}</dt><dd className="mt-2 text-2xl font-semibold">{value}</dd></div>)}</dl>}
    <EmptyState title="Your workspace foundation is ready" description="Individual feature screens are reserved for the next implementation stage." />
  </PageContainer>
}
