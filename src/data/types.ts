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
  | 'amusement'
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
  /** Needs booking ahead (tickets, popular restaurants): when booking opens, and whether it's done. */
  booking?: Booking
  /** We've been here: for the trip journal. */
  visit?: Visit
  createdBy: string
  createdAt: number
  updatedAt: number
}

export interface Visit {
  /** YYYY-MM-DD (Japan calendar). */
  on: string
  /** 1-5 stars. */
  rating?: number
  note?: string
}

export interface Booking {
  /** The day reservations open (YYYY-MM-DD, Japan calendar); unset = already open. */
  opensOn?: string
  booked?: boolean
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
  /**
   * Where the group sleeps, as check-ins: a date maps to the saved place (usually a hotel) from that
   * night on, until the next entry; '' ends the stay (e.g. a night flight). See stayFor().
   */
  stays: Record<string, string>
  flights: Flight[]
  createdAt: number
}

/** One message in the trip's group chat. */
export interface ChatMessage {
  id: string
  authorId: string
  authorName: string
  text: string
  /** Sender's clock (ms): keeps the order stable even for messages written offline. */
  createdAt: number
  /** Written on this device but not yet delivered to the server (no connection). */
  pending?: boolean
}
