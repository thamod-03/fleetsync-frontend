import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'vite'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const deploymentKeys = ['NODE_ENV', 'VERCEL', 'VERCEL_ENV', 'VERCEL_TARGET_ENV', 'VERCEL_GIT_COMMIT_REF', 'VITE_FLEETSYNC_STAGING', 'VITE_VERCEL_ENV', 'VITE_VERCEL_TARGET_ENV']
const snapshotEnvironment = () => Object.fromEntries(deploymentKeys.map((key) => [key, process.env[key]]))
const setEnvironment = (values) => {
  for (const key of deploymentKeys) {
    if (values[key] === undefined) delete process.env[key]
    else process.env[key] = values[key]
  }
}
const preview = { VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview' }
const production = { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production', VERCEL_GIT_COMMIT_REF: 'staging' }

test('production artifacts exclude mock authentication and utilities even with development NODE_ENV', async () => {
  const originalEnvironment = snapshotEnvironment()
  try {
    const deniedDeployments = [
      {},
      { VITE_FLEETSYNC_STAGING: 'true', VITE_VERCEL_ENV: 'preview', VITE_VERCEL_TARGET_ENV: 'preview' },
      preview,
      { ...preview, VITE_FLEETSYNC_STAGING: 'false' },
      { ...preview, VERCEL: undefined, VITE_FLEETSYNC_STAGING: 'true' },
      { ...preview, VERCEL_TARGET_ENV: undefined, VITE_FLEETSYNC_STAGING: 'true' },
      { ...preview, VERCEL_ENV: 'production', VITE_FLEETSYNC_STAGING: 'true' },
      { ...preview, VERCEL_TARGET_ENV: 'production', VITE_FLEETSYNC_STAGING: 'true' },
      { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_TARGET_ENV: 'production', VITE_FLEETSYNC_STAGING: 'true' },
      production,
      { ...production, VITE_FLEETSYNC_STAGING: 'false' },
      // A branch named staging and public aliases cannot override the real target.
      { ...production, VITE_FLEETSYNC_STAGING: 'true', VITE_VERCEL_ENV: 'preview', VITE_VERCEL_TARGET_ENV: 'preview' },
    ]
    for (const deployment of deniedDeployments) {
      for (const environment of ['production', 'development']) {
        setEnvironment({ ...deployment, NODE_ENV: environment })
        const result = await build({ mode: environment, logLevel: 'error', build: { write: false } })
        const bundles = Array.isArray(result) ? result : [result]
        const chunks = bundles.flatMap((bundle) => bundle.output).filter((item) => item.type === 'chunk')
        const code = chunks.map((chunk) => chunk.code).join('\n')
        for (const forbidden of ['FleetSyncDemo1!', '/__development', 'Development utilities', 'Reset Demo Data', 'alex@fleetsync.example']) {
          assert.equal(code.includes(forbidden), false, `${environment} build contains ${forbidden}`)
        }
        const modules = chunks.flatMap((chunk) => Object.keys(chunk.modules)).map((path) => path.replaceAll('\\', '/'))
        for (const forbidden of ['/src/development/', '/src/data/auth-services.ts', '/src/data/communication-services.ts', '/src/data/communication-projections.ts', '/src/data/message-notifications.ts', '/src/data/report-services.ts', '/src/data/coordinator-services.ts', '/src/data/trip-services.ts', '/src/data/trip-management-services.ts', '/src/data/trip-projections.ts', '/src/data/trip-notifications.ts', '/src/data/order-projections.ts', '/src/data/quotation-notifications.ts', '/src/data/mock-services.ts', '/src/data/seed.ts', '/src/store/demo-store.ts']) {
          assert.equal(modules.some((path) => path.includes(forbidden)), false, `${environment} build imports ${forbidden}`)
        }
        assert.ok(code.includes('This service is currently unavailable. Please try again later.'))
      }
    }
  } finally {
    setEnvironment(originalEnvironment)
  }
})

test('opted-in Preview builds include mock services but exclude developer tools and persona UI', async () => {
  const originalEnvironment = snapshotEnvironment()
  try {
    setEnvironment({ ...preview, NODE_ENV: 'production', VITE_FLEETSYNC_STAGING: 'true' })
    const result = await build({ logLevel: 'error', build: { write: false } })
    const chunks = (Array.isArray(result) ? result : [result]).flatMap((bundle) => bundle.output).filter((item) => item.type === 'chunk')
    const code = chunks.map((chunk) => chunk.code).join('\n')
    const modules = chunks.flatMap((chunk) => Object.keys(chunk.modules)).map((name) => name.replaceAll('\\', '/'))
    assert.ok(modules.some((name) => name.endsWith('/src/data/auth-services.ts')))
    assert.ok(modules.some((name) => name.endsWith('/src/store/demo-store.ts')))
    for (const forbidden of ['/__development', 'Development utilities', 'Reset Demo Data']) assert.equal(code.includes(forbidden), false)
    assert.equal(modules.some((name) => name.endsWith('/src/development/tools-page.tsx')), false)
  } finally {
    setEnvironment(originalEnvironment)
  }
})

test('built service facade allows opted-in Preview and rejects Production on a staging branch', async () => {
  const originalEnvironment = snapshotEnvironment()
  const directory = await mkdtemp(path.join(tmpdir(), 'fleetsync-auth-build-'))
  try {
    await writeFile(path.join(directory, 'package.json'), '{"type":"module"}')
    const scenarios = [
      { name: 'preview-disabled', env: preview, enabled: false },
      { name: 'preview-enabled', env: { ...preview, VITE_VERCEL_ENV: 'preview', VITE_FLEETSYNC_STAGING: 'true' }, enabled: true },
      { name: 'production-disabled', env: production, enabled: false },
      { name: 'production-enabled', env: { ...production, VITE_FLEETSYNC_STAGING: 'true' }, enabled: false },
    ]
    for (const { name, env, enabled } of scenarios) {
      setEnvironment({ ...env, NODE_ENV: 'production' })
      const result = await build({
        logLevel: 'error', ssr: { noExternal: true },
        build: { ssr: 'src/services/application-services.ts', write: false, rollupOptions: { output: { entryFileNames: `facade-${name}.js` } } },
      })
      for (const bundle of Array.isArray(result) ? result : [result]) {
        for (const item of bundle.output) {
          await mkdir(path.dirname(path.join(directory, item.fileName)), { recursive: true })
          await writeFile(path.join(directory, item.fileName), item.type === 'chunk' ? item.code : item.source)
        }
      }
      const { applicationServices, initializeApplicationServices, getCurrentUser } = await import(pathToFileURL(path.join(directory, `facade-${name}.js`)).href)
      await initializeApplicationServices()
      assert.equal(getCurrentUser(), null)
      for (const [email, role] of [['alex@fleetsync.example', 'admin'], ['maya@harbor.example', 'customer'], ['ravi@fleetsync.example', 'coordinator']]) {
        const result = await applicationServices.login({ email, password: 'FleetSyncDemo1!', rememberSession: true })
        assert.equal(result.ok, enabled, `${name}: credential login for ${role}`)
        if (enabled) {
          assert.equal(result.data.role, role)
          assert.equal(getCurrentUser().role, role)
        } else {
          assert.match(result.error, /service is currently unavailable/)
          assert.equal(getCurrentUser(), null)
        }
        await applicationServices.logout()
        assert.equal(getCurrentUser(), null)
      }
    }
  } finally {
    setEnvironment(originalEnvironment)
    // mkdtemp creates only our explicitly named directory under the OS temp root.
    assert.equal(path.dirname(directory), tmpdir())
    assert.ok(path.basename(directory).startsWith('fleetsync-auth-build-'))
    await rm(directory, { recursive: true, force: true })
  }
})
