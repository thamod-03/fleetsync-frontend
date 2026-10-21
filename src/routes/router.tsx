import { CustomerChatPage } from '../features/customer/chat-page'
import { CustomerQuotationsPage, CustomerQuotationPage } from '../features/customer/quotation-page'
import { CustomerPaymentPage } from '../features/customer/payment-page'
import { CustomerPaymentResultPage, CustomerInvoicePage } from '../features/customer/payment-result-page'
import { CustomerPaymentHistoryPage } from '../features/customer/payment-history-page'
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
import { CustomerOrdersPage } from '../features/customer/orders-page'
import { NewCustomerOrderPage } from '../features/customer/new-order-page'
import { CustomerOrderDetailsPage } from '../features/customer/order-details-page'
import { CoordinatorDashboardPage } from '../features/coordinator/dashboard-page'
import { SubmittedOrdersPage } from '../features/coordinator/submitted-orders-page'
import { ReviewOrderPage } from '../features/coordinator/review-order-page'
import { AvailabilityPage } from '../features/coordinator/availability-page'
import { CreateTripPage } from '../features/coordinator/create-trip-page'
import { TripAssignedPage } from '../features/coordinator/trip-assigned-page'
import { TripListPage } from '../features/coordinator/trip-list-page'
import { TripDetailsPage } from '../features/coordinator/trip-details-page'
import { ReportsPage } from '../features/coordinator/reports-page'
import { ChatPage } from '../features/coordinator/chat-page'
import { MailPage } from '../features/coordinator/mail-page'
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
      { index: true, element: <CustomerDashboardPage /> },
      { path: 'orders', element: <CustomerOrdersPage /> },
      { path: 'orders/new', element: <NewCustomerOrderPage /> },
      { path: 'orders/:orderId', element: <CustomerOrderDetailsPage /> },
      { path: 'quotations', element: <CustomerQuotationsPage /> },
      { path: 'quotations/:quotationId', element: <CustomerQuotationPage /> },
      { path: 'quotations/:quotationId/payment', element: <CustomerPaymentPage /> },
      { path: 'payments', element: <CustomerPaymentHistoryPage /> },
      { path: 'chat', element: <CustomerChatPage /> },
      { path: 'payments/:paymentId/success', element: <CustomerPaymentResultPage expected="Succeeded" /> },
      { path: 'payments/:paymentId/failed', element: <CustomerPaymentResultPage expected="Failed" /> },
      { path: 'payments/:paymentId/invoice', element: <CustomerInvoicePage /> },
      { path: '*', element: <SystemPage kind="not-found" /> },
    ] }] },
    { element: <RoleGuard role="coordinator" />, children: [{ path: '/coordinator', element: <AppShell />, children: [
      { index: true, element: <CoordinatorDashboardPage /> },
      { path: 'orders', element: <SubmittedOrdersPage /> },
      { path: 'orders/:orderId', element: <ReviewOrderPage /> },
      { path: 'availability', element: <AvailabilityPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'mail', element: <MailPage /> },
      { path: 'trips/create', element: <CreateTripPage /> },
      { path: 'trips', element: <TripListPage /> },
      { path: 'trips/:tripId', element: <TripDetailsPage /> },
      { path: 'trips/:tripId/cancel', element: <TripDetailsPage /> },
      { path: 'trips/:tripId/assigned', element: <TripAssignedPage /> },
      { path: '*', element: <SystemPage kind="not-found" /> },
    ] }] },
    { path: '/unauthorized', element: <SystemPage kind="unauthorized" /> },
    { path: '/access-denied', element: <SystemPage kind="unauthorized" /> },
    { path: '*', element: <SystemPage kind="not-found" /> },
  ],
}]
