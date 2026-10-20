import { createStore } from 'zustand/vanilla'
import { browserStorage, loadSnapshot, saveSnapshot, type DemoSnapshot, type StoragePort } from '../lib/demo-storage.ts'

export interface DemoState extends DemoSnapshot { storageNotice: string | null }

export function createDemoStore(storage: StoragePort = browserStorage()) {
  const store = createStore<DemoState>(() => loadSnapshot(storage))
  const persist = () => {
    const { data, sessionUserId, rememberSession } = store.getState()
    const message = 'Browser storage is unavailable. Changes will last only for this open page.'
    if (!saveSnapshot(storage, { data, sessionUserId: rememberSession === false ? null : sessionUserId, rememberSession }) && store.getState().storageNotice !== message) {
      store.setState({ storageNotice: message })
    }
  }
  store.subscribe((state, previous) => {
    if (state.data !== previous.data || state.sessionUserId !== previous.sessionUserId || state.rememberSession !== previous.rememberSession) persist()
  })
  persist()
  return store
}

export type DemoStore = ReturnType<typeof createDemoStore>
export const demoStore = createDemoStore()
