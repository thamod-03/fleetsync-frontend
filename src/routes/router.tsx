import { Outlet, type RouteObject } from 'react-router'
import { AppShell } from '../components/layout/app-shell'
import { AuthLayout } from '../components/layout/auth-layout'
import { LoginPage } from '../features/auth/login-page'
import { AuthPlaceholder } from '../features/auth/auth-placeholder'
import { AdminDashboardPage } from '../features/admin/dashboard-page'
import { CustomerDashboardPage } from '../features/customer/dashboard-page'
import { CoordinatorDashboardPage } from '../features/coordinator/dashboard-page'
import { RoleGuard } from './role-guard'
import { HomeRedirect, RouteErrorPage, SystemPage } from './system-pages'

export const routes: RouteObject[] = [{
  element: <Outlet />, errorElement: <RouteErrorPage />, children: [
    { index: true, element: <HomeRedirect /> },
    { element: <AuthLayout />, children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <AuthPlaceholder title="Customer registration" /> },
      { path: '/register/customer', element: <AuthPlaceholder title="Customer registration" /> },
      { path: '/forgot-password', element: <AuthPlaceholder title="Password recovery" /> },
      { path: '/reset-password', element: <AuthPlaceholder title="Reset password" /> },
      { path: '/apply/staff', element: <AuthPlaceholder title="Staff application" /> },
    ] },
    { element: <RoleGuard role="admin" />, children: [{ path: '/admin', element: <AppShell />, children: [
      { index: true, element: <AdminDashboardPage /> }, { path: '*', element: <SystemPage kind="not-found" /> },
    ] }] },
    { element: <RoleGuard role="customer" />, children: [{ path: '/customer', element: <AppShell />, children: [
      { index: true, element: <CustomerDashboardPage /> }, { path: '*', element: <SystemPage kind="not-found" /> },
    ] }] },
    { element: <RoleGuard role="coordinator" />, children: [{ path: '/coordinator', element: <AppShell />, children: [
      { index: true, element: <CoordinatorDashboardPage /> }, { path: '*', element: <SystemPage kind="not-found" /> },
    ] }] },
    { path: '/unauthorized', element: <SystemPage kind="unauthorized" /> },
    { path: '/access-denied', element: <SystemPage kind="unauthorized" /> },
    { path: '*', element: <SystemPage kind="not-found" /> },
  ],
}]
