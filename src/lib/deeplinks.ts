import type { LatLng } from '@/data/types'

export type TravelMode = 'transit' | 'walking' | 'driving'

/**
 * Universal Google Maps directions link. On phones it opens the native Google Maps app
 * (Android intent filter / iOS universal link); elsewhere it opens maps.google.com.
 * https://developers.google.com/maps/documentation/urls/get-started#directions-action
 */
export function directionsUrl(destination: LatLng, options: { placeId?: string; mode?: TravelMode; origin?: LatLng } = {}): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${destination.lat},${destination.lng}`,
    travelmode: options.mode ?? 'transit',
  })
  if (options.placeId) params.set('destination_place_id', options.placeId)
  // Without an origin Google starts from the phone's current location.
  if (options.origin) params.set('origin', `${options.origin.lat},${options.origin.lng}`)
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

/** Opens the place itself in Google Maps (reviews, photos, hours — everything Google has). */
export function placeUrl(place: { name: string; location: LatLng; googlePlaceId?: string }): string {
  const { lat, lng } = place.location
  if (!place.googlePlaceId && /[A-Za-z]/.test(place.name)) {
    // A map-data place (e.g. "Sushi Tetsu Pontocho"): search Google by name around our position, so
    // Google shows its own listing (exact pin, reviews) instead of a bare pin on our coordinates.
    return `https://www.google.com/maps/search/${encodeURIComponent(place.name)}/@${lat},${lng},17z`
  }
  const params = new URLSearchParams({ api: '1' })
  if (place.googlePlaceId) {
    params.set('query', place.name)
    params.set('query_place_id', place.googlePlaceId)
  } else {
    params.set('query', `${lat},${lng}`)
  }
  return `https://www.google.com/maps/search/?${params.toString()}`
}

/** Only allow http(s) links from user / third-party data. */
export function safeHttpUrl(value: string | undefined | null): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

/** Booking.com search for a hotel by name (opens its page and prices in the app or the site). */
export function bookingComUrl(hotelName: string): string {
  return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotelName)}&lang=he`
}

/** Agoda search for a hotel by name. */
export function agodaUrl(hotelName: string): string {
  return `https://www.agoda.com/search?text=${encodeURIComponent(hotelName)}`
}
