import { useEffect } from 'react'
import { errorMessage, type Backend } from '@/backend'
import { removePlaceEverywhere } from '@/data/planOps'
import { useSession } from '@/store/session'
import { recallActiveTrip, setPlaces, useTripStore } from '@/store/trip'

/** Sample places whose deletion was already sent (snapshots can show them again until it lands). */
const removing = new Set<string>()

/**
 * Trips once could start with a sample itinerary. Those sample places were written together with
 * the trip (same moment, by its owner), which no hand-added place can match; remove them for good.
 */
function removeSamplePlaces(backend: Backend, tripId: string) {
  const { trips, places, plan } = useTripStore.getState()
  const trip = trips.find((t) => t.id === tripId)
  if (!trip) return
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
        const { activeTripId: current } = useTripStore.getState()
        const remembered = recallActiveTrip(uid)
        const pick =
          [current, remembered].find((id) => id && trips.some((trip) => trip.id === id)) ?? trips[0]?.id ?? null
        useTripStore.setState({ trips, tripsLoaded: true, tripsConfirmed: confirmed, activeTripId: pick, syncError: null })
      },
      (error) => useTripStore.setState({ tripsLoaded: true, syncError: errorMessage(error) }),
    )
  }, [backend, uid])

  useEffect(() => {
    if (!backend || !activeTripId) return
    useTripStore.setState({ places: [], placesById: {}, placesLoaded: false, plan: {}, planLoaded: false })

    const onError = (error: unknown) => useTripStore.setState({ syncError: errorMessage(error) })
    const stopPlaces = backend.watchPlaces(activeTripId, setPlaces, onError)
    const stopPlan = backend.watchPlan(activeTripId, (plan) => useTripStore.setState({ plan, planLoaded: true }), onError)
    return () => {
      stopPlaces()
      stopPlan()
    }
  }, [backend, activeTripId])

  // Re-checked on every places update: the first snapshot may come from an incomplete offline cache.
  useEffect(() => {
    if (backend && activeTripId && tripDataLoaded) removeSamplePlaces(backend, activeTripId)
  }, [backend, activeTripId, tripDataLoaded, places])

  // The chat stays subscribed on every tab, so the tab bar can show unread messages.
  useEffect(() => {
    if (!backend || !activeTripId) return
    useTripStore.setState({ messages: [], messagesLoaded: false, chatError: null })
    return backend.watchMessages(
      activeTripId,
      (messages) => useTripStore.setState({ messages, messagesLoaded: true, chatError: null }),
      (error) => useTripStore.setState({ messagesLoaded: true, chatError: errorMessage(error) }),
    )
  }, [backend, activeTripId])

  return null
}
