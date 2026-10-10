import {
  Banknote,
  BedDouble,
  Luggage,
  Pill,
  ShieldCheck,
  Stethoscope,
  Store,
  Toilet,
  TrainFront,
  WashingMachine,
  type LucideIcon,
} from 'lucide-react'
import type { CategoryId } from '@/data/types'

/** Everyday needs on the street, found around the user ("I need … now"). */
export type NeedId = 'toilet' | 'atm' | 'konbini' | 'station' | 'locker' | 'pharmacy' | 'clinic' | 'laundry' | 'police' | 'hotel'

export type HotelBudget = 'budget' | 'mid' | 'luxury'

/** Hotel tiers: the label, and the Google text search that finds well-reviewed places of that kind. */
export const HOTEL_BUDGETS: Record<HotelBudget, { label: string; query: string }> = {
  budget: { label: 'חסכוני', query: 'best rated budget business hotel or hostel' },
  mid: { label: 'בינוני', query: 'best rated 3 or 4 star hotel' },
  luxury: { label: 'יוקרתי', query: 'best rated luxury 5 star hotel' },
}

/** Hotels are picked by reviews within a few kilometres, not by the nearest walk. */
export const HOTEL_RADIUS_M = 3000
export const HOTEL_MIN_RATING = 4.0
export const HOTEL_MIN_REVIEWS = 150

export interface NeedConfig {
  id: NeedId
  label: string
  /** "3 כספומטים קרובים" */
  plural: string
  icon: LucideIcon
  color: string
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
    icon: Toilet,
    color: '#0ea5e9',
    label: 'שירותים',
    plural: 'שירותים',
    noun: 'שירותים ציבוריים',
    tip: 'כמעט בכל מכולת (7-Eleven, Lawson, FamilyMart), תחנת רכבת וחנות כלבו יש שירותים נקיים שפתוחים לכולם',
    category: 'other',
    googleTypes: ['public_bathroom'],
    googleQuery: 'public toilet',
    osmFilters: ['["amenity"="toilets"]'],
  },
  {
    id: 'atm',
    icon: Banknote,
    color: '#16a34a',
    label: 'כספומט',
    plural: 'כספומטים',
    noun: 'כספומט',
    tip: 'כרטיס ישראלי עובד בדרך כלל בכספומטים של 7-Eleven (Seven Bank) ושל דואר יפן. הם מסומנים כאן ב"כרטיס זר"',
    category: 'other',
    googleTypes: ['atm'],
    osmFilters: ['["amenity"="atm"]', '["amenity"="bank"]["atm"="yes"]'],
  },
  {
    id: 'konbini',
    icon: Store,
    color: '#e8890c',
    label: 'מכולת',
    plural: 'מכולות',
    noun: 'מכולת',
    tip: 'פתוחות 24/7: אוכל, שתייה, כספומט, שירותים וטעינה לטלפון',
    category: 'shopping',
    googleTypes: ['convenience_store'],
    osmFilters: ['["shop"="convenience"]'],
  },
  {
    id: 'station',
    icon: TrainFront,
    color: '#64748b',
    label: 'תחנת רכבת',
    plural: 'תחנות רכבת',
    noun: 'תחנת רכבת',
    tip: 'כרטיס Suica או PASMO עובד בכל הרכבות והאוטובוסים בעיר. בתחנות הגדולות שווה לבדוק מראש איזו יציאה (出口) הכי קרובה ליעד',
    category: 'transport',
    googleTypes: ['train_station', 'subway_station'],
    osmFilters: ['["railway"="station"]'],
  },
  {
    id: 'locker',
    icon: Luggage,
    color: '#4f46e5',
    label: 'לוקרים',
    plural: 'לוקרים',
    noun: 'לוקרים',
    tip: 'בתחנות הגדולות יש לוקרים בכמה גדלים, ורובם מקבלים כרטיס Suica. מזוודה גדולה? חפשו את הלוקרים הגדולים ליד היציאות',
    category: 'transport',
    googleQuery: 'coin locker',
    osmFilters: ['["amenity"~"^(locker|luggage_locker)$"]'],
  },
  {
    id: 'pharmacy',
    icon: Pill,
    color: '#db2777',
    label: 'בית מרקחת',
    plural: 'בתי מרקחת',
    noun: 'בית מרקחת',
    tip: 'ב"דראגסטור" (ドラッグストア) יש תרופות ללא מרשם, ובבית מרקחת (薬局) גם רוקח. שווה להראות לרוקח את שם התרופה באנגלית',
    category: 'shopping',
    googleTypes: ['pharmacy', 'drugstore'],
    osmFilters: ['["amenity"="pharmacy"]', '["shop"="chemist"]'],
  },
  {
    id: 'clinic',
    icon: Stethoscope,
    color: '#dc2626',
    label: 'מרפאה',
    plural: 'מרפאות ובתי חולים',
    noun: 'מרפאה',
    tip: 'במצב חירום חייגו 119 (אמבולנס). בבתי החולים הגדולים יש לרוב מי שמדבר אנגלית. קחו איתכם דרכון ואת פוליסת הביטוח',
    category: 'other',
    googleTypes: ['hospital', 'doctor'],
    googleQuery: 'clinic',
    osmFilters: ['["amenity"~"^(hospital|clinic|doctors)$"]'],
  },
  {
    id: 'laundry',
    icon: WashingMachine,
    color: '#0891b2',
    label: 'מכבסה',
    plural: 'מכבסות',
    noun: 'מכבסה בשירות עצמי',
    tip: 'מכבסות בשירות עצמי (コインランドリー) פתוחות עד מאוחר, ויש בהן מכונות שמכבסות ומייבשות יחד בכ-45 דקות. מטבעות של 100 ין יעזרו',
    category: 'other',
    googleQuery: 'coin laundry',
    osmFilters: ['["shop"="laundry"]'],
  },
  {
    id: 'police',
    icon: ShieldCheck,
    color: '#2563eb',
    label: 'משטרה',
    plural: 'תחנות משטרה',
    noun: 'קובאן (עמדת משטרה)',
    tip: 'בכל שכונה יש "קובאן" (交番), עמדת משטרה קטנה שעוזרת בהכוונה ובחפצים שאבדו. במצב חירום: 110',
    category: 'other',
    googleTypes: ['police'],
    osmFilters: ['["amenity"="police"]'],
  },
  {
    id: 'hotel',
    icon: BedDouble,
    color: '#7c3aed',
    label: 'מלונות',
    plural: 'מלונות מומלצים',
    noun: 'מלון',
    tip: 'מלונות עם דירוג גבוה באזור, לפי רמת התקציב. חדרים ביפן קטנים, אז בחרו מלון קרוב לתחנת רכבת. המחירים וההזמנה באתרי ההזמנות',
    category: 'hotel',
    googleTypes: ['lodging'],
    osmFilters: ['["tourism"~"^(hotel|hostel|guest_house)$"]'],
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
