import { distanceMeters } from '@/lib/geo'
import type { LatLng } from './types'

export interface City {
  id: string
  name: string
  location: LatLng
}

/** Common stops on a Japan itinerary. Used for day labels, weather and default map views. */
export const CITIES: City[] = [
  { id: 'tokyo', name: 'טוקיו', location: { lat: 35.6812, lng: 139.7671 } },
  { id: 'kyoto', name: 'קיוטו', location: { lat: 35.0116, lng: 135.7681 } },
  { id: 'osaka', name: 'אוסקה', location: { lat: 34.6937, lng: 135.5023 } },
  { id: 'nara', name: 'נארה', location: { lat: 34.6851, lng: 135.8048 } },
  { id: 'hakone', name: 'הקונה', location: { lat: 35.2324, lng: 139.1069 } },
  { id: 'kawaguchiko', name: 'קוואגוצ׳יקו (פוג׳י)', location: { lat: 35.5164, lng: 138.7515 } },
  { id: 'kamakura', name: 'קמאקורה', location: { lat: 35.3192, lng: 139.5467 } },
  { id: 'nikko', name: 'ניקו', location: { lat: 36.7199, lng: 139.6982 } },
  { id: 'hiroshima', name: 'הירושימה', location: { lat: 34.3853, lng: 132.4553 } },
  { id: 'miyajima', name: 'מיאג׳ימה', location: { lat: 34.296, lng: 132.3198 } },
  { id: 'kobe', name: 'קובה', location: { lat: 34.6901, lng: 135.1955 } },
  { id: 'kanazawa', name: 'קנאזאווה', location: { lat: 36.5613, lng: 136.6562 } },
  { id: 'takayama', name: 'טקאיאמה', location: { lat: 36.1461, lng: 137.2522 } },
  { id: 'matsumoto', name: 'מטסומוטו', location: { lat: 36.238, lng: 137.972 } },
  { id: 'nagoya', name: 'נגויה', location: { lat: 35.1815, lng: 136.9066 } },
  { id: 'fukuoka', name: 'פוקואוקה', location: { lat: 33.5904, lng: 130.4017 } },
  { id: 'sapporo', name: 'סאפורו', location: { lat: 43.0618, lng: 141.3545 } },
  { id: 'okinawa', name: 'אוקינאווה', location: { lat: 26.2124, lng: 127.6809 } },
]

const BY_ID = new Map(CITIES.map((city) => [city.id, city]))

export const DEFAULT_CITY: City = CITIES[0]!

export function getCity(id: string | undefined | null): City | undefined {
  return id ? BY_ID.get(id) : undefined
}

/** Places farther than this from every listed city belong to none of them. */
const NEAREST_MAX_M = 60_000

/** The listed city a place belongs to (the nearest one), e.g. Disneyland → Tokyo, USJ → Osaka. */
export function nearestCity(location: LatLng): City | undefined {
  let best: City | undefined
  let bestDistance = NEAREST_MAX_M
  for (const city of CITIES) {
    const distance = distanceMeters(location, city.location)
    if (distance < bestDistance) {
      best = city
      bestDistance = distance
    }
  }
  return best
}
