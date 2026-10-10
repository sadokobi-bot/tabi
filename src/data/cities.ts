import { distanceMeters } from '@/lib/geo'
import type { LatLng } from './types'

export interface City {
  id: string
  name: string
  /** English name, for map searches. */
  en: string
  location: LatLng
}

/** Common stops on a Japan itinerary. Used for day labels, weather and default map views. */
export const CITIES: City[] = [
  { id: 'tokyo', name: 'טוקיו', en: 'Tokyo', location: { lat: 35.6812, lng: 139.7671 } },
  { id: 'kyoto', name: 'קיוטו', en: 'Kyoto', location: { lat: 35.0116, lng: 135.7681 } },
  { id: 'osaka', name: 'אוסקה', en: 'Osaka', location: { lat: 34.6937, lng: 135.5023 } },
  { id: 'nara', name: 'נארה', en: 'Nara', location: { lat: 34.6851, lng: 135.8048 } },
  { id: 'hakone', name: 'הקונה', en: 'Hakone', location: { lat: 35.2324, lng: 139.1069 } },
  { id: 'kawaguchiko', name: 'קוואגוצ׳יקו (פוג׳י)', en: 'Kawaguchiko', location: { lat: 35.5164, lng: 138.7515 } },
  { id: 'kamakura', name: 'קמאקורה', en: 'Kamakura', location: { lat: 35.3192, lng: 139.5467 } },
  { id: 'nikko', name: 'ניקו', en: 'Nikko', location: { lat: 36.7199, lng: 139.6982 } },
  { id: 'hiroshima', name: 'הירושימה', en: 'Hiroshima', location: { lat: 34.3853, lng: 132.4553 } },
  { id: 'miyajima', name: 'מיאג׳ימה', en: 'Miyajima', location: { lat: 34.296, lng: 132.3198 } },
  { id: 'kobe', name: 'קובה', en: 'Kobe', location: { lat: 34.6901, lng: 135.1955 } },
  { id: 'kanazawa', name: 'קנאזאווה', en: 'Kanazawa', location: { lat: 36.5613, lng: 136.6562 } },
  { id: 'takayama', name: 'טקאיאמה', en: 'Takayama', location: { lat: 36.1461, lng: 137.2522 } },
  { id: 'matsumoto', name: 'מטסומוטו', en: 'Matsumoto', location: { lat: 36.238, lng: 137.972 } },
  { id: 'nagoya', name: 'נגויה', en: 'Nagoya', location: { lat: 35.1815, lng: 136.9066 } },
  { id: 'fukuoka', name: 'פוקואוקה', en: 'Fukuoka', location: { lat: 33.5904, lng: 130.4017 } },
  { id: 'sapporo', name: 'סאפורו', en: 'Sapporo', location: { lat: 43.0618, lng: 141.3545 } },
  { id: 'okinawa', name: 'אוקינאווה', en: 'Okinawa', location: { lat: 26.2124, lng: 127.6809 } },
]

const BY_ID = new Map(CITIES.map((city) => [city.id, city]))

export const DEFAULT_CITY: City = CITIES[0]!
export const POPULAR_CITY_IDS = ['tokyo', 'kyoto', 'osaka']
export const SPECIAL_TRANSIT_CITIES: Record<string, string> = {
  okinawa: 'אוקינאווה דורשת טיסת פנים (כשעתיים מטוקיו/אוסקה). כדאי להקדיש יום למעבר. כרטיסים ב-Peach, Jetstar או ANA — מומלץ להזמין מראש.',
  sapporo: 'סאפורו בהוקאידו — אפשר להגיע בשינקנסן (כ-8 שעות מטוקיו) או בטיסת פנים (שעה וחצי). טיסה מומלצת לחיסכון בזמן.',
}

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
