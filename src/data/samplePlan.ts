import type { TripSeed } from '@/backend'
import { addDays } from '@/lib/dates'
import { newId } from '@/lib/ids'
import type { CategoryId, DayPlan, LatLng, Place } from './types'

interface SamplePlace {
  key: string
  name: string
  category: CategoryId
  location: LatLng
  notes?: string
}

/** Well-known spots for a first Japan trip (hand-checked coordinates). */
const SAMPLE_PLACES: SamplePlace[] = [
  { key: 'sensoji', name: 'מקדש סנסו-ג׳י (אסקוסה)', category: 'attraction', location: { lat: 35.7148, lng: 139.7967 }, notes: 'מומלץ להגיע מוקדם בבוקר' },
  { key: 'skytree', name: 'טוקיו סקייטרי', category: 'attraction', location: { lat: 35.7101, lng: 139.8107 } },
  { key: 'tsukiji', name: 'השוק החיצוני של צוקיג׳י', category: 'food', location: { lat: 35.6655, lng: 139.7707 } },
  { key: 'teamlab', name: 'teamLab Planets', category: 'attraction', location: { lat: 35.6491, lng: 139.7898 }, notes: 'להזמין כרטיסים מראש' },
  { key: 'meiji', name: 'מקדש מייג׳י', category: 'attraction', location: { lat: 35.6764, lng: 139.6993 } },
  { key: 'shibuya', name: 'צומת שיבויה', category: 'attraction', location: { lat: 35.6595, lng: 139.7005 } },
  { key: 'shibuyasky', name: 'Shibuya Sky', category: 'attraction', location: { lat: 35.6585, lng: 139.7023 }, notes: 'הכי יפה בשקיעה' },
  { key: 'gyoen', name: 'גן שינג׳וקו גיואן', category: 'nature', location: { lat: 35.6852, lng: 139.71 } },
  { key: 'omoide', name: 'אומוידה יוקוצ׳ו', category: 'food', location: { lat: 35.6929, lng: 139.6996 } },
  { key: 'akihabara', name: 'אקיהברה', category: 'shopping', location: { lat: 35.6984, lng: 139.7731 } },
  { key: 'owakudani', name: 'אוואקודני', category: 'nature', location: { lat: 35.2437, lng: 139.0198 } },
  { key: 'ashi', name: 'אגם אשי ומקדש הקונה', category: 'nature', location: { lat: 35.2048, lng: 139.0255 } },
  { key: 'fushimi', name: 'פושימי אינארי', category: 'attraction', location: { lat: 34.9671, lng: 135.7727 }, notes: 'אלפי שערי טוריי. להגיע לפני 8:00' },
  { key: 'kiyomizu', name: 'קיומיזו-דרה', category: 'attraction', location: { lat: 34.9949, lng: 135.785 } },
  { key: 'gion', name: 'גיון והנאמיקוג׳י', category: 'attraction', location: { lat: 35.0037, lng: 135.7751 } },
  { key: 'nishiki', name: 'שוק נישיקי', category: 'food', location: { lat: 35.005, lng: 135.7649 } },
  { key: 'arashiyama', name: 'יער הבמבוק בארשיאמה', category: 'nature', location: { lat: 35.017, lng: 135.6713 } },
  { key: 'arabica', name: '% Arabica ארשיאמה', category: 'cafe', location: { lat: 35.0143, lng: 135.6774 } },
  { key: 'kinkakuji', name: 'קינקקו-ג׳י (מקדש הזהב)', category: 'attraction', location: { lat: 35.0394, lng: 135.7292 } },
  { key: 'todaiji', name: 'טודאי-ג׳י', category: 'attraction', location: { lat: 34.689, lng: 135.8398 } },
  { key: 'narapark', name: 'פארק נארה (הצבאים)', category: 'nature', location: { lat: 34.6851, lng: 135.843 } },
  { key: 'osakacastle', name: 'טירת אוסקה', category: 'attraction', location: { lat: 34.6873, lng: 135.5262 } },
  { key: 'kuromon', name: 'שוק קורומון', category: 'food', location: { lat: 34.6654, lng: 135.5066 } },
  { key: 'dotonbori', name: 'דוטונבורי', category: 'food', location: { lat: 34.6687, lng: 135.5013 }, notes: 'טקויאקי ואוקונומיאקי בערב' },
  { key: 'usj', name: 'יוניברסל סטודיוס יפן', category: 'attraction', location: { lat: 34.6654, lng: 135.4323 } },
  { key: 'peacepark', name: 'פארק הזיכרון לשלום', category: 'attraction', location: { lat: 34.3955, lng: 132.4536 } },
  { key: 'itsukushima', name: 'מקדש איצוקושימה (שער טוריי בים)', category: 'attraction', location: { lat: 34.2959, lng: 132.3199 } },
]

/** [day index (0-based), city, [placeKey, time][]] */
const SAMPLE_DAYS: [number, string, [string, string][]][] = [
  [0, 'tokyo', [['sensoji', '09:00'], ['skytree', '13:00']]],
  [1, 'tokyo', [['tsukiji', '08:30'], ['teamlab', '11:30']]],
  [2, 'tokyo', [['meiji', '09:30'], ['shibuya', '15:00'], ['shibuyasky', '17:30']]],
  [3, 'tokyo', [['gyoen', '10:00'], ['omoide', '19:00']]],
  [4, 'tokyo', [['akihabara', '11:00']]],
  [5, 'hakone', [['owakudani', '11:00'], ['ashi', '14:30']]],
  [6, 'kyoto', [['fushimi', '07:30'], ['kiyomizu', '13:00'], ['gion', '18:00']]],
  [7, 'kyoto', [['nishiki', '10:30']]],
  [8, 'kyoto', [['arashiyama', '08:00'], ['arabica', '10:30'], ['kinkakuji', '14:00']]],
  [9, 'nara', [['todaiji', '10:00'], ['narapark', '12:30']]],
  [10, 'osaka', [['osakacastle', '10:00'], ['kuromon', '13:00'], ['dotonbori', '19:00']]],
  [11, 'osaka', [['usj', '09:00']]],
  [12, 'hiroshima', [['peacepark', '10:00']]],
  [13, 'miyajima', [['itsukushima', '11:00']]],
]

export function buildSampleSeed(startDate: string, days: number, uid: string): TripSeed {
  const now = Date.now()
  const idByKey = new Map<string, string>()
  const places: Place[] = SAMPLE_PLACES.map((sample, index) => {
    const id = newId()
    idByKey.set(sample.key, id)
    return {
      id,
      name: sample.name,
      category: sample.category,
      location: sample.location,
      ...(sample.notes ? { notes: sample.notes } : {}),
      createdBy: uid,
      createdAt: now + index,
      updatedAt: now + index,
    }
  })

  const plan: DayPlan = {}
  const dayCities: Record<string, string> = {}
  for (const [dayIndex, city, stops] of SAMPLE_DAYS) {
    if (dayIndex >= days) continue
    const date = addDays(startDate, dayIndex)
    dayCities[date] = city
    plan[date] = stops.map(([key, time]) => ({ id: newId(), placeId: idByKey.get(key)!, time }))
  }
  // Fly home from Tokyo: label the last day too.
  if (days > SAMPLE_DAYS.length) dayCities[addDays(startDate, days - 1)] = 'tokyo'

  return { places, plan, dayCities }
}
