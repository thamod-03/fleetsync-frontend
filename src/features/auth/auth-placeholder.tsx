import { Link } from 'react-router'
import { EmptyState } from '../../components/ui/page-states'

export function AuthPlaceholder({ title }: { title: string }) {
  return <EmptyState title={title} description="This authentication screen is reserved for the next Figma implementation stage. No information is collected or sent. Use a demo persona to explore the foundation." action={<Link className="text-sm underline underline-offset-4" to="/login">Return to demo login</Link>} />
}
