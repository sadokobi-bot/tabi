import { useEffect } from 'react'
import { errorMessage } from '@/backend'
import { useSession } from '@/store/session'
import { recallActiveTrip, setPlaces, useTripStore } from '@/store/trip'

/**
 * Keeps the trip store in sync with the backend:
 * the signed-in user's trips, and the places + plan of the active trip (real-time in cloud mode).
 */
export function TripDataSync() {
  const backend = useSession((state) => state.backend)
  const uid = useSession((state) => state.user?.uid)
  const activeTripId = useTripStore((state) => state.activeTripId)

  useEffect(() => {
    if (!backend || !uid) return
    useTripStore.setState({ trips: [], tripsLoaded: false, activeTripId: null, syncError: null })

    return backend.watchTrips(
      uid,
      (trips) => {
        const { activeTripId: current } = useTripStore.getState()
        const remembered = recallActiveTrip(uid)
        const pick =
          [current, remembered].find((id) => id && trips.some((trip) => trip.id === id)) ?? trips[0]?.id ?? null
        useTripStore.setState({ trips, tripsLoaded: true, activeTripId: pick, syncError: null })
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

  return null
}
