import { z } from 'zod'
import { demoDatasetSchema, webRoles } from '../types/domain.ts'
import type { DemoDataset } from '../types/domain.ts'
import { createSeedData } from '../data/seed.ts'

export const DEMO_STORAGE_KEY = 'fleetsync-demo-v1'
export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
export interface DemoSnapshot { data: DemoDataset; sessionUserId: string | null; rememberSession?: boolean }
const savedSchema = z.object({ version: z.literal(1), data: demoDatasetSchema, sessionUserId: z.string().nullable(), rememberSession: z.boolean().optional() })

export function browserStorage(): StoragePort {
  return {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  }
}

export function loadSnapshot(storage: StoragePort): DemoSnapshot & { storageNotice: string | null } {
  try {
    const raw = storage.getItem(DEMO_STORAGE_KEY)
    if (raw === null) return { data: createSeedData(), sessionUserId: null, storageNotice: null }
    const saved = savedSchema.parse(JSON.parse(raw))
    const session = saved.data.users.find((user) => user.id === saved.sessionUserId && user.accountStatus !== 'Pending' && webRoles.some((role) => role === user.role))
    return { data: saved.data, sessionUserId: saved.rememberSession === false ? null : session?.id ?? null, rememberSession: saved.rememberSession, storageNotice: null }
  } catch {
    return { data: createSeedData(), sessionUserId: null, storageNotice: 'Saved data could not be restored. Starting data has been restored.' }
  }
}

export function saveSnapshot(storage: StoragePort, snapshot: DemoSnapshot): boolean {
  try {
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ version: 1, ...snapshot }))
    return true
  } catch {
    return false
  }
}
