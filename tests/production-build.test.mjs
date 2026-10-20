import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'vite'

test('production artifacts exclude mock authentication and utilities even with development NODE_ENV', async () => {
  const originalEnvironment = process.env.NODE_ENV
  try {
    for (const environment of ['production', 'development']) {
      process.env.NODE_ENV = environment
      const result = await build({ mode: environment, logLevel: 'error', build: { write: false } })
      const bundles = Array.isArray(result) ? result : [result]
      const chunks = bundles.flatMap((bundle) => bundle.output).filter((item) => item.type === 'chunk')
      const code = chunks.map((chunk) => chunk.code).join('\n')
      for (const forbidden of ['FleetSyncDemo1!', '/__development', 'Development utilities', 'Reset Demo Data', 'alex@fleetsync.example']) {
        assert.equal(code.includes(forbidden), false, `${environment} build contains ${forbidden}`)
      }
      const modules = chunks.flatMap((chunk) => Object.keys(chunk.modules)).map((path) => path.replaceAll('\\', '/'))
      for (const forbidden of ['/src/development/', '/src/data/auth-services.ts', '/src/data/coordinator-services.ts', '/src/data/quotation-notifications.ts', '/src/data/mock-services.ts', '/src/data/seed.ts', '/src/store/demo-store.ts']) {
        assert.equal(modules.some((path) => path.includes(forbidden)), false, `${environment} build imports ${forbidden}`)
      }
      assert.ok(code.includes('This service is currently unavailable. Please try again later.'))
    }
  } finally {
    if (originalEnvironment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalEnvironment
  }
})
