import type { LatLng } from './types'

export interface City {
  id: string
  name: string
  /** Japanese name (decorative, e.g. on the day stamp). */
  kanji: string
  location: LatLng
}

/** Common stops on a Japan itinerary. Used for day labels, weather and default map views. */
export const CITIES: City[] = [
  { id: 'tokyo', name: 'טוקיו', kanji: '東京', location: { lat: 35.6812, lng: 139.7671 } },
  { id: 'kyoto', name: 'קיוטו', kanji: '京都', location: { lat: 35.0116, lng: 135.7681 } },
  { id: 'osaka', name: 'אוסקה', kanji: '大阪', location: { lat: 34.6937, lng: 135.5023 } },
  { id: 'nara', name: 'נארה', kanji: '奈良', location: { lat: 34.6851, lng: 135.8048 } },
  { id: 'hakone', name: 'הקונה', kanji: '箱根', location: { lat: 35.2324, lng: 139.1069 } },
  { id: 'kawaguchiko', name: 'קוואגוצ׳יקו (פוג׳י)', kanji: '河口湖', location: { lat: 35.5164, lng: 138.7515 } },
  { id: 'kamakura', name: 'קמאקורה', kanji: '鎌倉', location: { lat: 35.3192, lng: 139.5467 } },
  { id: 'nikko', name: 'ניקו', kanji: '日光', location: { lat: 36.7199, lng: 139.6982 } },
  { id: 'hiroshima', name: 'הירושימה', kanji: '広島', location: { lat: 34.3853, lng: 132.4553 } },
  { id: 'miyajima', name: 'מיאג׳ימה', kanji: '宮島', location: { lat: 34.296, lng: 132.3198 } },
  { id: 'kobe', name: 'קובה', kanji: '神戸', location: { lat: 34.6901, lng: 135.1955 } },
  { id: 'kanazawa', name: 'קנאזאווה', kanji: '金沢', location: { lat: 36.5613, lng: 136.6562 } },
  { id: 'takayama', name: 'טקאיאמה', kanji: '高山', location: { lat: 36.1461, lng: 137.2522 } },
  { id: 'matsumoto', name: 'מטסומוטו', kanji: '松本', location: { lat: 36.238, lng: 137.972 } },
  { id: 'nagoya', name: 'נגויה', kanji: '名古屋', location: { lat: 35.1815, lng: 136.9066 } },
  { id: 'fukuoka', name: 'פוקואוקה', kanji: '福岡', location: { lat: 33.5904, lng: 130.4017 } },
  { id: 'sapporo', name: 'סאפורו', kanji: '札幌', location: { lat: 43.0618, lng: 141.3545 } },
  { id: 'okinawa', name: 'אוקינאווה', kanji: '沖縄', location: { lat: 26.2124, lng: 127.6809 } },
]

const BY_ID = new Map(CITIES.map((city) => [city.id, city]))

export const DEFAULT_CITY: City = CITIES[0]!

export function getCity(id: string | undefined | null): City | undefined {
  return id ? BY_ID.get(id) : undefined
}
