import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { matchRoutes, MemoryRouter } from 'react-router'

test('configured routes resolve and shared pages render without a browser', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  try {
    const { routes } = await server.ssrLoadModule('/src/routes/router.tsx')
    const { initializeApplicationServices, applicationServices } = await server.ssrLoadModule('/src/services/application-services.ts')
    await initializeApplicationServices()
    assert.equal(matchRoutes(routes, '/__development').at(-1).route.path, '/__development')
    for (const path of ['/login', '/register', '/forgot-password', '/reset-password', '/apply/staff', '/admin', '/customer', '/coordinator', '/coordinator/orders', '/coordinator/orders/order-002', '/unauthorized']) {
      const matches = matchRoutes(routes, path)
      assert.ok(matches?.length, `${path} must resolve`)
      assert.notEqual(matches.at(-1).route.path, '*', `${path} must have an explicit route`)
      assert.ok(renderToString(createElement(MemoryRouter, { initialEntries: [path] }, matches.at(-1).route.element)))
    }
    for (const path of ['/admin', '/customer', '/coordinator']) {
      const matches = matchRoutes(routes, path)
      assert.equal(matches[1].route.element.type.name, 'RoleGuard')
      assert.equal(matches[1].route.element.props.role, path.slice(1))
      assert.equal(matches[2].route.element.type.name, 'AppShell')
    }
    assert.equal(matchRoutes(routes, '/unknown').at(-1).route.path, '*')
    assert.equal(matchRoutes(routes, '/customer/unknown').at(-1).route.path, '*')
    const { Header } = await server.ssrLoadModule('/src/components/layout/header.tsx')
    const header = renderToString(createElement(MemoryRouter, null, createElement(Header, {
      user: { id: 'user-admin', name: 'Alex Silva', email: 'alex@fleetsync.example', role: 'admin' },
      expanded: false, onToggle: () => {},
    })))
    assert.match(header, /Alex Silva/)
    assert.match(header, /aria-haspopup="menu"/)
    const expectedFields = {
      '/login': ['Email address', 'Password', 'Keep me signed in', 'Forgot password?', 'Register as customer', 'Request staff account'],
      '/register': ['Company name', 'Business registration no.', 'Billing address', 'Full name', 'Mobile', 'Work email', 'Confirm password', 'terms of service'],
      '/forgot-password': ['Email address', 'Send reset link', 'Back to sign in'],
      '/reset-password': ['New password', 'Confirm new password', 'Update password'],
      '/apply/staff': ['NIC number', 'Role you', 'DOCUMENTS', 'Submit application'],
    }
    for (const [path, fields] of Object.entries(expectedFields)) {
      const matches = matchRoutes(routes, path)
      const markup = renderToString(createElement(MemoryRouter, { initialEntries: [path] }, matches.at(-1).route.element))
      assert.match(markup, /<form/)
      for (const field of fields) assert.ok(markup.includes(field), `${path} missing ${field}`)
      assert.doesNotMatch(markup, /https:\/\/www\.figma\.com\/api\/mcp\/asset/)
      assert.doesNotMatch(markup, /University demo|fictional|Demo accounts|persona switching|Demo application|simulate payments|FleetSyncDemo1!|DEMO-NIC/)
    }
    const { AuthLayout } = await server.ssrLoadModule('/src/components/layout/auth-layout.tsx')
    const layoutMarkup = renderToString(createElement(MemoryRouter, null, createElement(AuthLayout)))
    assert.match(layoutMarkup, /Real-time vehicle and driver availability/)
    assert.doesNotMatch(layoutMarkup, /University|auth-brand-note|Fictional details/)
    const { developmentAdapter } = await server.ssrLoadModule('/src/development/service-adapter.ts')
    const { StaffApplicationPage } = await server.ssrLoadModule('/src/features/auth/staff-application-page.tsx')
    const invitationMarkup = renderToString(createElement(MemoryRouter, null, createElement(StaffApplicationPage, { invitation: { reference: 'APP-2026-0124', expiresAt: '2026-10-26' } })))
    assert.match(invitationMarkup, /Application form APP-2026-0124/)
    assert.match(invitationMarkup, /26 Oct 2026/)
    let reads = 0
    const fakeFile = { name: 'NIC-front-and-back.pdf', size: 100, type: 'application/pdf', arrayBuffer() { reads++; throw new Error('Contents must never be read') }, text() { reads++; throw new Error('Contents must never be read') } }
    const attachment = await developmentAdapter.services.prepareDocuments([fakeFile])
    assert.equal(attachment.ok, true)
    assert.equal(reads, 0)
    if (attachment.ok) {
      assert.deepEqual(Object.keys(attachment.data[0]).sort(), ['format', 'kind', 'name', 'simulated', 'sizeBytes'])
    }
    assert.equal((await developmentAdapter.services.prepareDocuments([{ name: 'malware.exe', size: 100, type: 'application/octet-stream' }])).ok, false)
    assert.equal((await developmentAdapter.services.prepareDocuments([{ name: 'large.pdf', size: 6 * 1024 * 1024, type: 'application/pdf' }])).ok, false)
    const request = await applicationServices.requestPasswordReset({ email: 'unknown@fixture.example' })
    assert.equal(request.ok && request.data.delivered, false)
    if (request.ok) assert.match(request.data.message, /No reset email was sent/)
    assert.deepEqual(applicationServices.getResetContext(), { email: 'unknown@fixture.example' })
    const reset = await applicationServices.resetPassword({ password: 'AnotherFixture42', confirmPassword: 'AnotherFixture42' })
    assert.equal(reset.ok && reset.data.updated, false)
    const { mockServices } = await server.ssrLoadModule('/src/data/mock-services.ts')
    await mockServices.signIn('coordinator')
    const overview = await applicationServices.getCoordinatorOverview()
    assert.ok(overview.ok)
    const { CoordinatorDashboard } = await server.ssrLoadModule('/src/features/coordinator/dashboard-page.tsx')
    const dashboardMarkup = renderToString(createElement(MemoryRouter, null, createElement(CoordinatorDashboard, { data: overview.data, name: 'Ravi' })))
    for (const label of ['Orders to quote', 'Trips in progress', 'Vehicles available', 'Drivers available', 'Orders waiting for you', 'Active trips', 'Availability today', 'Order payments', 'Operational report', 'order-002', 'Harbor Paperworks']) assert.ok(dashboardMarkup.includes(label), `Dashboard missing ${label}`)
    assert.doesNotMatch(dashboardMarkup, /University demo|Choose a demo persona|FleetSyncDemo1!|6 orders need|17 in progress/)
    assert.match(dashboardMarkup, /disabled/)
    assert.match(dashboardMarkup, /href="\/coordinator\/orders\/order-002"/)
    const { SubmittedOrders } = await server.ssrLoadModule('/src/features/coordinator/submitted-orders-page.tsx')
    const ordersMarkup = renderToString(createElement(MemoryRouter, null, createElement(SubmittedOrders, { orders: overview.data.orders })))
    for (const label of ['Submitted orders', 'All open', 'Needs quotation', 'Ready for a trip', 'All payment statuses', 'Route &amp; pickup', 'Prepare quote', 'order-002']) assert.ok(ordersMarkup.includes(label), `Orders missing ${label}`)
    assert.match(ordersMarkup, /<table/)
    assert.match(ordersMarkup, /href="\/coordinator\/orders\/order-002"/)
    const { ReviewOrder } = await server.ssrLoadModule('/src/features/coordinator/review-order-page.tsx')
    const order = await applicationServices.getOrder('order-002')
    assert.ok(order.ok)
    const reviewMarkup = renderToString(createElement(MemoryRouter, null, createElement(ReviewOrder, { details: order.data }))).replaceAll(/<!--.*?-->/g, '')
    for (const label of ['Review order order-002', 'Customer', 'Route', 'Cargo', 'Fare estimation', 'Vehicle type needed', 'Distance charge', 'Loading and unloading', 'Fragile handling', 'Tolls and fees', 'Valid until', 'Message to customer (optional)', 'Save draft', 'Send quotation']) assert.ok(reviewMarkup.includes(label), `Review missing ${label}`)
    assert.match(reviewMarkup, /<form/)
    assert.match(reviewMarkup, /type="datetime-local"/)
    assert.doesNotMatch(reviewMarkup, /University demo|FleetSyncDemo1!|fictional|Quotation sent successfully/)
    for (const path of ['/coordinator/orders', '/coordinator/orders/order-002']) {
      assert.equal(matchRoutes(routes, path)[1].route.element.props.role, 'coordinator')
    }
    await mockServices.signIn('customer')
    const { getCurrentUser } = await server.ssrLoadModule('/src/services/application-services.ts')
    assert.equal(getCurrentUser().role, 'customer')
    await applicationServices.logout()
    assert.equal(getCurrentUser(), null)
    const { AuthBanner } = await server.ssrLoadModule('/src/features/auth/auth-components.tsx')
    const errorMarkup = renderToString(createElement(AuthBanner, { tone: 'danger', title: 'Incorrect email or password' }, 'Check your details and try again.'))
    assert.match(errorMarkup, /role="alert"/)
    assert.match(errorMarkup, /auth-banner-danger/)
  } finally {
    await server.close()
  }
})
