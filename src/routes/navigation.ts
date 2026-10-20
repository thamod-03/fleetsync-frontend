import { LayoutDashboard, type LucideIcon } from 'lucide-react'
import type { WebRole } from '../types/domain'

export const roleLabels: Record<WebRole, string> = {
  admin: 'Fleet Administrator', customer: 'Customer', coordinator: 'Operational Coordinator',
}
export const roleHome: Record<WebRole, string> = { admin: '/admin', customer: '/customer', coordinator: '/coordinator' }
export interface NavigationItem { label: string; to: string; icon: LucideIcon }
export const navigation: Record<WebRole, NavigationItem[]> = {
  admin: [{ label: 'Dashboard', to: '/admin', icon: LayoutDashboard }],
  customer: [{ label: 'Dashboard', to: '/customer', icon: LayoutDashboard }],
  coordinator: [{ label: 'Dashboard', to: '/coordinator', icon: LayoutDashboard }],
}
