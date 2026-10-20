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
    for (const path of ['/login', '/register', '/forgot-password', '/reset-password', '/apply/staff', '/admin', '/customer', '/coordinator', '/unauthorized']) {
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
  } finally {
    await server.close()
  }
})
