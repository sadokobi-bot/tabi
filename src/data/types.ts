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
  'attraction' | 'amusement' | 'food' | 'cafe' | 'shopping' | 'nightlife' | 'nature' | 'hotel' | 'transport' | 'other'

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
  /** Hotel details we type in ourselves (Google's own data is fetched live, never stored). */
  hotel?: HotelInfo
  /** Luggage forwarded here from the previous hotel (takkyubin). */
  luggage?: LuggageInfo
  createdBy: string
  createdAt: number
  updatedAt: number
}

export interface LuggageInfo {
  /** The day it was handed in (YYYY-MM-DD, Japan calendar). */
  sentOn: string
  /** The hotel it was sent from. */
  fromId: string
  tracking?: string
}

export interface HotelInfo {
  /** "HH:mm" */
  checkIn?: string
  checkOut?: string
  /** Booking / confirmation number. */
  code?: string
  phone?: string
  /** The address in Japanese, for a taxi driver (typed or pasted from the booking). */
  addressJa?: string
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

export type Gender = 'male' | 'female' | 'other'

export interface TripMember {
  name: string
  /** For Hebrew grammar ("מבקש" / "מבקשת"); absent for members who joined before profiles. */
  gender?: Gender
}

/** Someone asking to join a trip with its invite code; the owner approves or declines. */
export interface JoinRequest {
  uid: string
  name: string
  gender?: Gender
  /** When it was sent (ms). */
  at: number
  status: 'pending' | 'declined'
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

/** A member's live position, shared while the app is open and they opted in. */
export interface Presence {
  name: string
  location: LatLng
  /** Accuracy radius in meters. */
  accuracy: number
  /** When the position was taken (ms). */
  at: number
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

/**
 * An entry ticket saved ahead for a place (QR / barcode), shared with the whole trip. Stored as page
 * images (a PDF is rendered page by page when it's added), so it opens anywhere, also offline.
 */
export interface Ticket {
  id: string
  placeId: string
  name: string
  pages: number
  /** Who added it (display name). */
  addedBy: string
  at: number
}
