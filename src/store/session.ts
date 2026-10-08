import { create } from 'zustand'
import { loadBackend, type Backend, type SessionUser, type Unsubscribe } from '@/backend'
import { useUi } from './ui'

interface SessionState {
  backend: Backend | null
  status: 'loading' | 'signedOut' | 'signedIn' | 'error'
  user: SessionUser | null
}

export const useSession = create<SessionState>(() => ({ backend: null, status: 'loading', user: null }))

/** Loads the backend and mirrors its auth state into the store. Returns a cleanup function. */
export function startSession(): Unsubscribe {
  let cancelled = false
  let unsubscribe: Unsubscribe | undefined

  loadBackend()
    .then((backend) => {
      if (cancelled) return
      useSession.setState({ backend })
      unsubscribe = backend.onAuthChange((user) => {
        // Signing out happens inside the profile sheet: without this, the next sign-in opens on it.
        if (!user) useUi.setState({ profileOpen: false, selection: null, ticket: null, routeDate: null, pickingLocation: false })
        useSession.setState({ user, status: user ? 'signedIn' : 'signedOut' })
      })
    })
    .catch((error: unknown) => {
      console.error('[session] backend failed to load', error)
      if (!cancelled) useSession.setState({ status: 'error' })
    })

  return () => {
    cancelled = true
    unsubscribe?.()
  }
}

/** The loaded backend. Only call from UI rendered after the session finished loading. */
export function getBackend(): Backend {
  const backend = useSession.getState().backend
  if (!backend) throw new Error('Backend is not ready yet')
  return backend
}

const SIGNED_OUT: SessionUser = { uid: '', username: '' }

/**
 * The signed-in user, for screens behind the auth gate. During sign-out the store clears the
 * user one render before the gate unmounts these screens, so return a blank user instead of throwing.
 */
export function useCurrentUser(): SessionUser {
  return useSession((state) => state.user) ?? SIGNED_OUT
}
