import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { mockServices } from '../../data/mock-services'
import { demoStore } from '../../store/demo-store'
import { useDemoUser } from '../../hooks/use-demo'
import { Button } from '../ui/button'
import { EmptyState, ErrorState, LoadingState } from '../ui/page-states'
import { PageContainer } from './page-container'

type DashboardResult = Awaited<ReturnType<typeof mockServices.getDashboard>>
export function DemoDashboard({ title }: { title: string }) {
  const user = useDemoUser()
  const data = useStore(demoStore, (state) => state.data)
  const [result, setResult] = useState<DashboardResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [resetting, setResetting] = useState(false)
  const [feedback, setFeedback] = useState('')
  useEffect(() => {
    let active = true
    void mockServices.getDashboard().then((value) => { if (active) setResult(value) })
    return () => { active = false }
  }, [data, user?.id, attempt])
  const reset = async () => {
    setResetting(true)
    await mockServices.resetDemoData()
    setFeedback('Original fictional demo data restored. Your current persona is unchanged.')
    setResetting(false)
  }
  return <PageContainer title={title} description="Shared architecture preview · Final dashboard screens will follow the approved Figma frames.">
    {!result ? <LoadingState /> : !result.ok ? <ErrorState message={result.error} onRetry={() => setAttempt((value) => value + 1)} /> :
      <dl className="grid grid-cols-2 gap-4 xl:grid-cols-4">{Object.entries(result.data).map(([label, value]) => <div className="rounded-xl border bg-card p-5" key={label}><dt className="text-sm capitalize text-muted-foreground">{label === 'notifications' ? 'Unread demo notifications' : label}</dt><dd className="mt-2 text-2xl font-semibold">{value}</dd></div>)}</dl>}
    <EmptyState title="Your workspace foundation is ready" description="Individual feature screens are intentionally reserved for the next stage. Switch personas from the account menu; shared records stay in this browser profile." />
    <section className="space-y-3 rounded-xl border bg-card p-5"><h2 className="font-semibold">Demo data controls</h2><p className="text-sm text-muted-foreground">Reset replaces shared records with the original fictional dataset for all personas in this browser profile.</p>
      <Button variant="outline" disabled={resetting} onClick={() => void reset()}>{resetting ? 'Restoring…' : 'Reset Demo Data'}</Button>
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{feedback}</p>
    </section>
  </PageContainer>
}
