import { Outlet, type RouteObject } from 'react-router'
import { AppShell } from '../components/layout/app-shell'
import { AuthLayout } from '../components/layout/auth-layout'
import { LoginPage } from '../features/auth/login-page'
import { RegistrationPage } from '../features/auth/registration-page'
import { StaffApplicationPage } from '../features/auth/staff-application-page'
import { ForgotPasswordPage } from '../features/auth/forgot-password-page'
import { ResetPasswordPage } from '../features/auth/reset-password-page'
import { AdminDashboardPage } from '../features/admin/dashboard-page'
import { CustomerDashboardPage } from '../features/customer/dashboard-page'
import { CoordinatorDashboardPage } from '../features/coordinator/dashboard-page'
import { SubmittedOrdersPage } from '../features/coordinator/submitted-orders-page'
import { ReviewOrderPage } from '../features/coordinator/review-order-page'
import { RoleGuard } from './role-guard'
import { HomeRedirect, RouteErrorPage, SystemPage } from './system-pages'

export const routes: RouteObject[] = [{
  element: <Outlet />, errorElement: <RouteErrorPage />, children: [
    ...(import.meta.env.DEV && __FLEETSYNC_LOCAL_DEV__ ? [{ path: '/__development', lazy: () => import('../development/tools-page') }] : []),
    { index: true, element: <HomeRedirect /> },
    { element: <AuthLayout />, children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegistrationPage /> },
      { path: '/register/customer', element: <RegistrationPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/apply/staff', element: <StaffApplicationPage /> },
    ] },
    { element: <RoleGuard role="admin" />, children: [{ path: '/admin', element: <AppShell />, children: [
      { index: true, element: <AdminDashboardPage /> }, { path: '*', element: <SystemPage kind="not-found" /> },
    ] }] },
    { element: <RoleGuard role="customer" />, children: [{ path: '/customer', element: <AppShell />, children: [
      { index: true, element: <CustomerDashboardPage /> }, { path: '*', element: <SystemPage kind="not-found" /> },
    ] }] },
    { element: <RoleGuard role="coordinator" />, children: [{ path: '/coordinator', element: <AppShell />, children: [
      { index: true, element: <CoordinatorDashboardPage /> },
      { path: 'orders', element: <SubmittedOrdersPage /> },
      { path: 'orders/:orderId', element: <ReviewOrderPage /> },
      { path: '*', element: <SystemPage kind="not-found" /> },
    ] }] },
    { path: '/unauthorized', element: <SystemPage kind="unauthorized" /> },
    { path: '/access-denied', element: <SystemPage kind="unauthorized" /> },
    { path: '*', element: <SystemPage kind="not-found" /> },
  ],
}]
