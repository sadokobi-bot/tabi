import { useEffect, useRef, useState } from 'react'
import { firstName } from '@/backend'
import type { Presence } from '@/data/types'
import { distanceMeters } from '@/lib/geo'
import { recallSharing, usePresence } from '@/store/presence'
import { useSession } from '@/store/session'
import { useTripStore } from '@/store/trip'

/** Publish at most this often while standing still, and sooner after moving this far. */
const MIN_INTERVAL_MS = 20_000
const MIN_MOVE_M = 30
const MOVE_INTERVAL_MS = 5_000

/** The page is in front: iOS stops a home-screen app's GPS in the background anyway. */
function useVisible() {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible')
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return visible
}

/**
 * Live location sharing inside the trip: watches the members' shared positions, and, when this
 * member opted in, publishes their own while the app is open (throttled, so it's light on battery
 * and on the free Firestore quota). Turning sharing off withdraws the position.
 */
export function PresenceSync() {
  const backend = useSession((state) => state.backend)
  const user = useSession((state) => state.user)
  const tripId = useTripStore((state) => state.activeTripId)
  const sharing = usePresence((state) => state.sharing)
  const visible = useVisible()
  const last = useRef<Presence | null>(null)

  // Everyone's positions.
  useEffect(() => {
    if (!backend || !tripId) return
    usePresence.setState({ byUid: {} })
    return backend.watchPresence(
      tripId,
      (byUid) => usePresence.setState({ byUid }),
      (error) => console.warn('[presence] not available', error),
    )
  }, [backend, tripId])

  // The opt-in is remembered per user and trip.
  useEffect(() => {
    if (user && tripId) usePresence.setState({ sharing: recallSharing(user.uid, tripId) })
  }, [user, tripId])

  // Our own position, while sharing and in front.
  useEffect(() => {
    if (!backend || !user || !tripId || !sharing || !visible || !('geolocation' in navigator)) return
    const publish = (presence: Presence) => {
      last.current = presence
      backend.setPresence(tripId, user.uid, presence).catch((error: unknown) => console.warn('[presence] not sent', error))
    }
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const presence: Presence = {
          name: firstName(user),
          location: { lat: position.coords.latitude, lng: position.coords.longitude },
          accuracy: Math.round(position.coords.accuracy),
          at: Date.now(),
        }
        const previous = last.current
        const elapsed = previous ? presence.at - previous.at : Infinity
        const moved = previous ? distanceMeters(previous.location, presence.location) : Infinity
        if (elapsed >= MIN_INTERVAL_MS || (moved >= MIN_MOVE_M && elapsed >= MOVE_INTERVAL_MS)) publish(presence)
      },
      (error) => console.warn('[presence] no position', error.message),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [backend, user, tripId, sharing, visible])

  // Opting out withdraws the last shared position.
  useEffect(() => {
    if (sharing || !backend || !user || !tripId) return
    // Also a position left over from an earlier session.
    if (!last.current && !usePresence.getState().byUid[user.uid]) return
    last.current = null
    backend.setPresence(tripId, user.uid, null).catch(() => undefined)
  }, [sharing, backend, user, tripId])

  return null
}
