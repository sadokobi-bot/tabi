import type { Bounds, CategoryId, LatLng } from '@/data/types'

/** A point of interest from an external source (Google Places or OpenStreetMap), not yet saved. */
export interface Poi {
  /** Stable key: "g:<placeId>" or "osm:<type>/<id>". */
  key: string
  source: 'google' | 'osm'
  name: string
  category: CategoryId
  location: LatLng
  address?: string
  googlePlaceId?: string
  osmId?: string
  /** Google rating, when the source returned it (text search results). */
  rating?: number
  ratingCount?: number
  /** Extra facts OpenStreetMap carries (Google details are fetched separately). */
  extras?: {
    website?: string
    phone?: string
    openingHours?: string
    cuisine?: string
  }
}

export interface PoiPhoto {
  url: string
  attribution?: { name: string; uri?: string }
}

/** A weekly opening window: day 0 = Sunday, minutes since local midnight. No close = open around the clock. */
export interface OpeningPeriod {
  open: { day: number; minutes: number }
  close?: { day: number; minutes: number }
}

/** Rich, live details (Google only). Never persisted, per the Google Maps Platform ToS. */
export interface PoiDetails {
  name?: string
  category?: CategoryId
  photos: PoiPhoto[]
  rating?: number
  ratingCount?: number
  address?: string
  weekdayHours?: string[]
  openingPeriods?: OpeningPeriod[]
  website?: string
  phone?: string
  googleMapsUri?: string
  priceLevel?: string
  typeLabel?: string
}

export interface Suggestion {
  key: string
  title: string
  subtitle?: string
  resolve: () => Promise<Poi | null>
}

export type AreaResult = { status: 'ok'; pois: Poi[] } | { status: 'zoom-in' }

export interface PoiProvider {
  readonly id: 'google' | 'osm'
  /** Recommended places of the given categories inside the visible map area. */
  searchArea(bounds: Bounds, categories: CategoryId[], signal: AbortSignal): Promise<AreaResult>
  /** Type-ahead search across Japan, biased toward `near`. */
  suggest(input: string, near: LatLng | null, signal: AbortSignal): Promise<Suggestion[]>
  /** Live details for a Google place (photos, rating, hours…). */
  details(googlePlaceId: string): Promise<PoiDetails | null>
  /** Details already fetched this session, without a new request (undefined when not fetched yet). */
  peekDetails?(googlePlaceId: string): PoiDetails | null | undefined
  /** Finds the Google place matching a hand-added / sample place, so it can show photos and ratings. */
  matchGoogle?(name: string, location: LatLng): Promise<string | null>
  /** Real places for a free-text search ("wagyu restaurant in Shinjuku"), best first, biased toward `near`. */
  searchText(query: string, near: LatLng | null, signal: AbortSignal): Promise<Poi[]>
}

export function dedupePois(pois: Poi[]): Poi[] {
  const seen = new Set<string>()
  return pois.filter((poi) => (seen.has(poi.key) ? false : (seen.add(poi.key), true)))
}
