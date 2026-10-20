import { useEffect, useState } from 'react'
import { useApplicationRevision } from '../../hooks/use-demo'
import type { ServiceResult } from '../../services/contracts'

export function useCoordinatorQuery<T>(query: () => Promise<ServiceResult<T>>) {
  const revision = useApplicationRevision()
  const [attempt, setAttempt] = useState(0)
  const [snapshot, setSnapshot] = useState<{ query: typeof query; result: ServiceResult<T> } | null>(null)
  useEffect(() => {
    let current = true
    query().then((result) => { if (current) setSnapshot({ query, result }) }).catch(() => {
      if (current) setSnapshot({ query, result: { ok: false, error: 'Unable to load operational records. Please try again.' } })
    })
    return () => { current = false }
  }, [query, revision, attempt])
  return { result: snapshot?.query === query ? snapshot.result : null, retry: () => setAttempt((value) => value + 1) }
}
