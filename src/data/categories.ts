import {
  BedDouble,
  Coffee,
  Landmark,
  MapPin,
  ShoppingBag,
  TrainFront,
  Trees,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from 'lucide-react'
import type { CategoryId } from './types'

export interface CategoryConfig {
  id: CategoryId
  label: string
  plural: string
  color: string
  icon: LucideIcon
  /** Google Places (New) primary types (Table A) used for "recommended nearby" searches. */
  googleTypes: string[]
}

export const CATEGORIES: Record<CategoryId, CategoryConfig> = {
  attraction: {
    id: 'attraction',
    label: 'אטרקציה',
    plural: 'אטרקציות',
    color: '#e2553a',
    icon: Landmark,
    googleTypes: [
      'tourist_attraction',
      'museum',
      'historical_landmark',
      'cultural_landmark',
      'buddhist_temple',
      'castle',
      'observation_deck',
      'art_gallery',
      'amusement_park',
      'aquarium',
      'zoo',
      'monument',
    ],
  },
  food: {
    id: 'food',
    label: 'מסעדה',
    plural: 'מסעדות',
    color: '#e8890c',
    icon: UtensilsCrossed,
    googleTypes: ['restaurant', 'japanese_restaurant', 'ramen_restaurant', 'sushi_restaurant'],
  },
  cafe: {
    id: 'cafe',
    label: 'בית קפה',
    plural: 'בתי קפה',
    color: '#9a6b4f',
    icon: Coffee,
    googleTypes: ['cafe', 'coffee_shop', 'tea_house'],
  },
  shopping: {
    id: 'shopping',
    label: 'קניות',
    plural: 'קניות',
    color: '#8b5cf6',
    icon: ShoppingBag,
    googleTypes: ['shopping_mall', 'department_store', 'market', 'gift_shop'],
  },
  nightlife: {
    id: 'nightlife',
    label: 'בר',
    plural: 'ברים',
    color: '#db2777',
    icon: Wine,
    googleTypes: ['bar', 'pub', 'wine_bar', 'night_club'],
  },
  nature: {
    id: 'nature',
    label: 'טבע',
    plural: 'טבע ופארקים',
    color: '#16a34a',
    icon: Trees,
    googleTypes: ['park', 'national_park', 'botanical_garden', 'garden', 'hiking_area', 'beach'],
  },
  hotel: {
    id: 'hotel',
    label: 'לינה',
    plural: 'לינה',
    color: '#4f46e5',
    icon: BedDouble,
    googleTypes: ['lodging', 'hotel', 'hostel', 'japanese_inn'],
  },
  transport: {
    id: 'transport',
    label: 'תחבורה',
    plural: 'תחנות',
    color: '#475569',
    icon: TrainFront,
    googleTypes: ['train_station', 'subway_station'],
  },
  other: {
    id: 'other',
    label: 'אחר',
    plural: 'אחר',
    color: '#6b7280',
    icon: MapPin,
    googleTypes: [],
  },
}

export const CATEGORY_LIST = Object.values(CATEGORIES)

/** Categories offered as "recommendations" chips on the map, in display order. */
export const RECOMMENDABLE: CategoryId[] = ['attraction', 'food', 'cafe', 'shopping', 'nightlife', 'nature']

const GOOGLE_TYPE_TO_CATEGORY = new Map<string, CategoryId>()
for (const category of CATEGORY_LIST) {
  for (const type of category.googleTypes) GOOGLE_TYPE_TO_CATEGORY.set(type, category.id)
}

/** Best-effort category for a Google place from its primary type, then its other types. */
export function categoryFromGoogleTypes(primaryType?: string | null, types?: string[]): CategoryId {
  if (primaryType) {
    const direct = GOOGLE_TYPE_TO_CATEGORY.get(primaryType)
    if (direct) return direct
    if (primaryType.endsWith('_restaurant')) return 'food'
    if (primaryType.endsWith('_store') || primaryType.endsWith('_shop')) return 'shopping'
  }
  for (const type of types ?? []) {
    const match = GOOGLE_TYPE_TO_CATEGORY.get(type)
    if (match) return match
  }
  return 'other'
}
