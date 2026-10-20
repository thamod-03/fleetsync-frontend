import { useStore } from 'zustand'
import { demoStore } from '../store/demo-store.ts'

export function useDemoUser() {
  return useStore(demoStore, (state) => state.data.users.find((user) => user.id === state.sessionUserId) ?? null)
}

export function useStorageNotice() {
  return useStore(demoStore, (state) => state.storageNotice)
}
