import { Link } from 'react-router'
import { EmptyState } from '../../components/ui/page-states'

export function AuthPlaceholder({ title }: { title: string }) {
  return <EmptyState title={title} description="This page is not available yet." action={<Link className="text-sm underline underline-offset-4" to="/login">Return to sign in</Link>} />
}
