import type { CategoryId } from '@/data/types'

/** Everyday needs on the street, found around the user ("I need … now"). */
export type NeedId = 'toilet' | 'atm' | 'konbini' | 'locker' | 'pharmacy'

export interface NeedConfig {
  id: NeedId
  label: string
  /** "3 כספומטים קרובים" */
  plural: string
  emoji: string
  /** Name for places the map data leaves unnamed (most public toilets). */
  noun: string
  /** One practical line about this need in Japan. */
  tip: string
  /** Pin style on the map. */
  category: CategoryId
  /** Google place types (nearby search). */
  googleTypes?: string[]
  /** Google text search, when there's no fitting type or the type search finds nothing. */
  googleQuery?: string
  /** OpenStreetMap (Overpass) filters. */
  osmFilters: string[]
}

export const NEEDS: NeedConfig[] = [
  {
    id: 'toilet',
    label: 'שירותים',
    plural: 'שירותים',
    emoji: '🚻',
    noun: 'שירותים ציבוריים',
    tip: 'כמעט בכל מכולת (7-Eleven, Lawson, FamilyMart), תחנת רכבת וחנות כלבו יש שירותים נקיים שפתוחים לכולם',
    category: 'other',
    googleTypes: ['public_bathroom'],
    googleQuery: 'public toilet',
    osmFilters: ['["amenity"="toilets"]'],
  },
  {
    id: 'atm',
    label: 'כספומט',
    plural: 'כספומטים',
    emoji: '🏧',
    noun: 'כספומט',
    tip: 'כרטיס ישראלי עובד בדרך כלל בכספומטים של 7-Eleven (Seven Bank) ושל דואר יפן. מסומנים כאן ב-✓',
    category: 'other',
    googleTypes: ['atm'],
    osmFilters: ['["amenity"="atm"]', '["amenity"="bank"]["atm"="yes"]'],
  },
  {
    id: 'konbini',
    label: 'מכולת',
    plural: 'מכולות',
    emoji: '🏪',
    noun: 'מכולת',
    tip: 'פתוחות 24/7: אוכל, שתייה, כספומט, שירותים וטעינה לטלפון',
    category: 'shopping',
    googleTypes: ['convenience_store'],
    osmFilters: ['["shop"="convenience"]'],
  },
  {
    id: 'locker',
    label: 'לוקרים',
    plural: 'לוקרים',
    emoji: '🧳',
    noun: 'לוקרים',
    tip: 'בתחנות הגדולות יש לוקרים בכמה גדלים, ורובם מקבלים כרטיס Suica. מזוודה גדולה? חפשו את הלוקרים הגדולים ליד היציאות',
    category: 'transport',
    googleQuery: 'coin locker',
    osmFilters: ['["amenity"~"^(locker|luggage_locker)$"]'],
  },
  {
    id: 'pharmacy',
    label: 'בית מרקחת',
    plural: 'בתי מרקחת',
    emoji: '💊',
    noun: 'בית מרקחת',
    tip: 'ב"דראגסטור" (ドラッグストア) יש תרופות ללא מרשם, ובבית מרקחת (薬局) גם רוקח. שווה להראות לרוקח את שם התרופה באנגלית',
    category: 'shopping',
    googleTypes: ['pharmacy', 'drugstore'],
    osmFilters: ['["amenity"="pharmacy"]', '["shop"="chemist"]'],
  },
]

export const NEED_BY_ID = Object.fromEntries(NEEDS.map((need) => [need.id, need])) as Record<NeedId, NeedConfig>

/** How far to look: a walk of up to ~15 minutes. */
export const NEED_RADIUS_M = 1200
export const NEED_LIMIT = 12

/** Seven Bank (7-Eleven) and Japan Post ATMs take foreign cards. */
export function takesForeignCards(name: string): boolean {
  return /seven|7-eleven|7‐eleven|セブン|japan post|yucho|ゆうちょ|post office|郵便/i.test(name)
}

/** Walking time on foot at a relaxed pace, from the straight-line distance (streets add a bit). */
export function walkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters * 1.25) / 75))
}
