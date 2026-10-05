import { hasFirebase } from '@/config/env'
import type { Backend } from './types'

let backendPromise: Promise<Backend> | null = null

/**
 * Lazily loads the right backend. The Firebase SDK is only downloaded when Firebase is configured,
 * so the zero-setup local mode stays lightweight.
 */
export function loadBackend(): Promise<Backend> {
  backendPromise ??= hasFirebase
    ? import('./firebase').then((module) => module.createFirebaseBackend())
    : import('./local').then((module) => module.createLocalBackend())
  return backendPromise
}

export * from './types'
