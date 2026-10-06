import { create } from 'zustand'
import type { ChatMessage, DayPlan, ItineraryItem, Place, Trip } from '@/data/types'

interface TripState {
  trips: Trip[]
  tripsLoaded: boolean
  /** The trip list reflects the server, not just the offline cache (see Backend.watchTrips). */
  tripsConfirmed: boolean
  activeTripId: string | null
  /** When true the onboarding screen is shown even though trips exist ("add another trip"). */
  creatingTrip: boolean
  places: Place[]
  placesById: Record<string, Place>
  placesLoaded: boolean
  plan: DayPlan
  planLoaded: boolean
  syncError: string | null
  /** Group chat of the active trip, oldest first. */
  messages: ChatMessage[]
  messagesLoaded: boolean
  chatError: string | null
}

export const useTripStore = create<TripState>(() => ({
  trips: [],
  tripsLoaded: false,
  tripsConfirmed: false,
  activeTripId: null,
  creatingTrip: false,
  places: [],
  placesById: {},
  placesLoaded: false,
  plan: {},
  planLoaded: false,
  syncError: null,
  messages: [],
  messagesLoaded: false,
  chatError: null,
}))

const activeTripStorageKey = (uid: string) => `tabi:activeTrip:${uid}`

export function rememberActiveTrip(uid: string, tripId: string) {
  try {
    localStorage.setItem(activeTripStorageKey(uid), tripId)
  } catch {
    // Storage unavailable (private mode): the choice simply isn't remembered.
  }
}

export function recallActiveTrip(uid: string): string | null {
  try {
    return localStorage.getItem(activeTripStorageKey(uid))
  } catch {
    return null
  }
}

export function setPlaces(places: Place[]) {
  const sorted = [...places].sort((a, b) => a.createdAt - b.createdAt)
  useTripStore.setState({
    places: sorted,
    placesById: Object.fromEntries(sorted.map((place) => [place.id, place])),
    placesLoaded: true,
  })
}

/* ── Selectors ── */

export function useActiveTrip(): Trip | null {
  return useTripStore((state) => state.trips.find((trip) => trip.id === state.activeTripId) ?? null)
}

/** Active trip for screens that only render once a trip exists. */
export function useTrip(): Trip {
  const trip = useActiveTrip()
  if (!trip) throw new Error('useTrip() used before a trip was selected')
  return trip
}

export function usePlace(placeId: string | null | undefined): Place | undefined {
  return useTripStore((state) => (placeId ? state.placesById[placeId] : undefined))
}

/** Every (date, item) in the plan that references `placeId`. */
export function scheduleOf(plan: DayPlan, placeId: string): { date: string; item: ItineraryItem }[] {
  const hits: { date: string; item: ItineraryItem }[] = []
  for (const [date, items] of Object.entries(plan)) {
    for (const item of items) if (item.placeId === placeId) hits.push({ date, item })
  }
  return hits.sort((a, b) => a.date.localeCompare(b.date))
}
