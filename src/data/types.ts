export interface LatLng {
  lat: number
  lng: number
}

export interface Bounds {
  north: number
  south: number
  east: number
  west: number
}

export type CategoryId =
  | 'attraction'
  | 'food'
  | 'cafe'
  | 'shopping'
  | 'nightlife'
  | 'nature'
  | 'hotel'
  | 'transport'
  | 'other'

/** A place the group saved (from Google, OpenStreetMap or added by hand). */
export interface Place {
  id: string
  name: string
  category: CategoryId
  location: LatLng
  address?: string
  notes?: string
  url?: string
  /** Google place id. The only Google field we persist (allowed by the Maps ToS); details are fetched live. */
  googlePlaceId?: string
  /** OpenStreetMap element, e.g. "node/123456". */
  osmId?: string
  createdBy: string
  createdAt: number
  updatedAt: number
}

/** One stop in a day's plan. Times are wall-clock times in Japan ("HH:mm"). */
export interface ItineraryItem {
  id: string
  placeId: string
  time?: string
  note?: string
}

/** Itinerary keyed by ISO date (YYYY-MM-DD). */
export type DayPlan = Record<string, ItineraryItem[]>

export interface Flight {
  id: string
  label: string
  flightNo?: string
  from: string
  to: string
  /** Departure instant, ISO-8601 UTC. */
  departAt: string
  /** IANA time zone the departure time was entered in (for editing). */
  tz?: string
}

export interface TripMember {
  name: string
}

export interface Trip {
  id: string
  name: string
  /** First day of the trip, YYYY-MM-DD (Japan calendar). */
  startDate: string
  days: number
  ownerId: string
  memberIds: string[]
  members: Record<string, TripMember>
  inviteCode: string
  /** City id per date (see data/cities.ts). */
  dayCities: Record<string, string>
  flights: Flight[]
  createdAt: number
}
