import { useEffect } from 'react'
import { AppError, errorMessage, type Backend } from '@/backend'
import { removePlaceEverywhere } from '@/data/planOps'
import { prefetchTickets } from '@/data/tickets'
import { useOnline } from '@/hooks/useOnline'
import { useSession } from '@/store/session'
import { recallActiveTrip, setPlaces, useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

/** New trips stopped starting with sample places on 2026-10-06. */
const SAMPLES_ENDED_AT = Date.UTC(2026, 9, 7)

/** Sample places whose deletion was already sent (snapshots can show them again until it lands). */
const removing = new Set<string>()

/**
 * Trips once could start with a sample itinerary. Those sample places were written together with
 * the trip (same moment, by its owner), which no hand-added place can match; remove them for good.
 */
function removeSamplePlaces(backend: Backend, tripId: string) {
  const { trips, places, plan } = useTripStore.getState()
  const trip = trips.find((t) => t.id === tripId)
  // Only trips from those days: newer ones can get places right away (the whole-trip planner).
  if (!trip || trip.createdAt > SAMPLES_ENDED_AT) return
  const samples = places.filter(
    (place) => !removing.has(place.id) && place.createdBy === trip.ownerId && Math.abs(place.createdAt - trip.createdAt) < 5000,
  )
  if (samples.length === 0) return

  const sampleIds = new Set(samples.map((place) => place.id))
  sampleIds.forEach((id) => removing.add(id))
  let current = plan
  const writes = samples.map((place) => {
    const changes = removePlaceEverywhere(current, place.id)
    current = { ...current, ...changes }
    return { placeId: place.id, changes }
  })
  setPlaces(places.filter((place) => !sampleIds.has(place.id)))
  useTripStore.setState({ plan: current })

  // All queued at once, so the offline cache drops every sample right away (writes still land in order).
  Promise.all(writes.map(({ placeId, changes }) => backend.deletePlace(tripId, placeId, changes))).catch((error: unknown) =>
    console.error('[trip] sample places could not be removed', error),
  )
}

const RETRIES = 6

/**
 * Starts listeners and, when the server refuses them, starts them again a little later. A trip
 * created a moment ago appears in the local cache before the server has it, and the security rules
 * (which read the trip on the server) refuse its places / plan / chat until it lands. Any other error,
 * or a refusal that persists, goes to `onError`.
 */
function resubscribing(start: (onError: (error: unknown) => void) => () => void, onError: (error: unknown) => void): () => void {
  let stop: (() => void) | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  let closed = false

  const run = () => {
    let failed = false
    stop = start((error) => {
      if (failed || closed) return
      failed = true // several listeners may fail together: retry once for all of them
      if (error instanceof AppError && error.code === 'permission-denied' && attempt < RETRIES) {
        attempt++
        stop?.()
        timer = setTimeout(run, 600 * attempt)
      } else {
        onError(error)
      }
    })
  }

  run()
  return () => {
    closed = true
    clearTimeout(timer)
    stop?.()
  }
}

/**
 * Keeps the trip store in sync with the backend:
 * the signed-in user's trips, and the places, plan and chat of the active trip (real-time in cloud mode).
 */
export function TripDataSync() {
  const backend = useSession((state) => state.backend)
  const uid = useSession((state) => state.user?.uid)
  const activeTripId = useTripStore((state) => state.activeTripId)
  const tripDataLoaded = useTripStore((state) => state.placesLoaded && state.planLoaded && state.tripsConfirmed)
  const places = useTripStore((state) => state.places)

  useEffect(() => {
    if (!backend || !uid) return
    useTripStore.setState({ trips: [], tripsLoaded: false, tripsConfirmed: false, activeTripId: null, syncError: null })

    return backend.watchTrips(
      uid,
      (trips, confirmed) => {
        const { activeTripId: current, trips: before } = useTripStore.getState()
        // The open trip is gone for good (the owner removed us, or deleted it): say so.
        const lost = confirmed && current ? before.find((trip) => trip.id === current && !trips.some((t) => t.id === current)) : undefined
        // (The owner deleting it sees the deletion screen instead.)
        if (lost && lost.ownerId !== uid) ui.toast(`הטיול "${lost.name}" כבר לא ברשימה שלכם`)
        const remembered = recallActiveTrip(uid)
        const pick = [current, remembered].find((id) => id && trips.some((trip) => trip.id === id)) ?? trips[0]?.id ?? null
        useTripStore.setState({ trips, tripsLoaded: true, tripsConfirmed: confirmed, activeTripId: pick, syncError: null })
      },
      (error) => useTripStore.setState({ tripsLoaded: true, syncError: errorMessage(error) }),
    )
  }, [backend, uid])

  useEffect(() => {
    if (!backend || !activeTripId) return
    useTripStore.setState({ places: [], placesById: {}, placesLoaded: false, plan: {}, planLoaded: false })

    return resubscribing(
      (onError) => {
        const stopPlaces = backend.watchPlaces(activeTripId, setPlaces, onError)
        const stopPlan = backend.watchPlan(activeTripId, (plan) => useTripStore.setState({ plan, planLoaded: true }), onError)
        return () => {
          stopPlaces()
          stopPlan()
        }
      },
      (error) => useTripStore.setState({ syncError: errorMessage(error) }),
    )
  }, [backend, activeTripId])

  // Re-checked on every places update: the first snapshot may come from an incomplete offline cache.
  useEffect(() => {
    if (backend && activeTripId && tripDataLoaded) removeSamplePlaces(backend, activeTripId)
  }, [backend, activeTripId, tripDataLoaded, places])

  // Join requests, for the trip's owner only (the rules let nobody else list them).
  const ownsTrip = useTripStore((state) => {
    const trip = state.trips.find((t) => t.id === state.activeTripId)
    return Boolean(trip && uid && trip.ownerId === uid)
  })
  useEffect(() => {
    useTripStore.setState({ joinRequests: [] })
    if (!backend || !activeTripId || !ownsTrip) return
    return backend.watchJoinRequests(
      activeTripId,
      (joinRequests) => useTripStore.setState({ joinRequests }),
      (error) => console.warn('[trip] join requests unavailable', error),
    )
  }, [backend, activeTripId, ownsTrip])

  // Entry tickets: the list, and every ticket's pages kept on this device for the gate (no signal there).
  const tickets = useTripStore((state) => state.tickets)
  const online = useOnline()
  useEffect(() => {
    useTripStore.setState({ tickets: [] })
    if (!backend || !activeTripId) return
    return resubscribing(
      (onError) => backend.watchTickets(activeTripId, (tickets) => useTripStore.setState({ tickets }), onError),
      (error) => console.warn('[trip] tickets unavailable', error),
    )
  }, [backend, activeTripId])
  useEffect(() => {
    if (!online || tickets.length === 0) return
    const signal = { cancelled: false }
    void prefetchTickets(tickets, signal)
    return () => {
      signal.cancelled = true
    }
  }, [tickets, online])

  // Read markers and typing indicators.
  useEffect(() => {
    useTripStore.setState({ chatMeta: { read: {}, typing: {} } })
    if (!backend || !activeTripId) return
    return resubscribing(
      (onError) => backend.watchChatMeta(activeTripId, (chatMeta) => useTripStore.setState({ chatMeta }), onError),
      (error) => console.warn('[trip] chat read markers unavailable', error),
    )
  }, [backend, activeTripId])

  // The chat stays subscribed on every tab, so the tab bar can show unread messages.
  useEffect(() => {
    if (!backend || !activeTripId) return
    useTripStore.setState({ messages: [], messagesLoaded: false, chatError: null })
    return resubscribing(
      (onError) =>
        backend.watchMessages(
          activeTripId,
          (messages) => useTripStore.setState({ messages, messagesLoaded: true, chatError: null }),
          onError,
        ),
      (error) => useTripStore.setState({ messagesLoaded: true, chatError: errorMessage(error) }),
    )
  }, [backend, activeTripId])

  return null
}
