import type { User, WebRole } from '../types/domain.ts'

export function getAccessRedirect(user: User | null, role: WebRole, requestedPath: string): string | null {
  if (!user) return `/login?from=${encodeURIComponent(requestedPath)}`
  return user.role === role ? null : '/unauthorized'
}

export function getLoginDestination(role: WebRole, requested: string | null): string {
  const home = `/${role}`
  return requested && (requested === home || requested.startsWith(`${home}/`) || requested.startsWith(`${home}?`)) ? requested : home
}
