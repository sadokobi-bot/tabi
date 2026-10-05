import { create } from 'zustand'
import { loadBackend, type Backend, type SessionUser, type Unsubscribe } from '@/backend'

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
      unsubscribe = backend.onAuthChange((user) =>
        useSession.setState({ user, status: user ? 'signedIn' : 'signedOut' }),
      )
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

export function useCurrentUser(): SessionUser {
  const user = useSession((state) => state.user)
  if (!user) throw new Error('useCurrentUser() used outside a signed-in screen')
  return user
}
