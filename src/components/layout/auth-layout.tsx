import { Link, Outlet } from 'react-router'
import { useStorageNotice } from '../../hooks/use-demo'

export function AuthLayout() {
  const notice = useStorageNotice()
  return <div className="flex min-h-svh flex-col bg-muted/30">
    <header className="border-b bg-background px-6 py-5"><Link to="/" className="text-lg font-semibold">FleetSync</Link></header>
    <main id="main-content" className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 p-4 sm:p-8">
      {notice && <p role="status" className="rounded-lg border bg-card p-4 text-sm">{notice}</p>}
      <Outlet />
    </main>
    <footer className="p-5 text-center text-xs text-muted-foreground">University demonstration · Fictional data · No real authentication or deliveries</footer>
  </div>
}
