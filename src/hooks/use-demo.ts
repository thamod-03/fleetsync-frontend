import { useSyncExternalStore } from 'react'
import { getApplicationRevision, getCurrentUser, getStorageNotice, subscribeApplication } from '../services/application-services'

export function useDemoUser() {
  return useSyncExternalStore(subscribeApplication, getCurrentUser, getCurrentUser)
}

export function useStorageNotice() {
  return useSyncExternalStore(subscribeApplication, getStorageNotice, getStorageNotice)
}

export function useApplicationRevision() {
  return useSyncExternalStore(subscribeApplication, getApplicationRevision, getApplicationRevision)
}
