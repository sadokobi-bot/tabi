import type { LatLng } from '@/data/types'
import type { Poi, PoiProvider } from '@/maps/poi'
import type { MapOption } from './assistant'

export type Diet = 'kosher' | 'vegan' | 'vegetarian'

/** What to tell travellers who keep kosher: no certified restaurants, but Chabad houses. */
export const KOSHER_INFO =
  'ביפן נכון לעכשיו אין מסעדות עם תעודת כשרות. יש בתי חב״ד בערים הגדולות (טוקיו, קיוטו, אוסקה) שמגישים ארוחות כשרות, כדאי לתאם איתם מראש.'

/** The note under a plan that was asked to be kosher. */
export function kosherNote(chabad?: string): string {
  return chabad
    ? `${KOSHER_INFO} שבצנו ארוחה ב${/^[A-Za-z]/.test(chabad) ? '-' : ''}${chabad}, ושאר הארוחות במסעדות צמחוניות או טבעוניות.`
    : `${KOSHER_INFO} בינתיים הארוחות בתוכנית הן במסעדות צמחוניות או טבעוניות.`
}

/** A food wish in the travellers' own words. */
export function dietOf(text: string): Diet | null {
  if (/כשר|kosher/i.test(text)) return 'kosher'
  if (/טבעונ|vegan/i.test(text)) return 'vegan'
  if (/צמחונ|vegetarian/i.test(text)) return 'vegetarian'
  return null
}

const DIET_QUERIES: Record<Diet, string[]> = {
  // Kosher places in Japan are few: the plant-based ones are the fallback.
  kosher: ['kosher restaurant', 'Chabad house', 'vegan restaurant', 'vegetarian restaurant'],
  vegan: ['vegan restaurant', 'vegetarian restaurant'],
  vegetarian: ['vegetarian restaurant', 'vegan restaurant'],
}

const SEARCH_TIMEOUT_MS = 8000

export interface MapOptions {
  options: MapOption[]
  pois: Record<string, Poi>
}

/** Map searches around a point, as numbered options ("r1", "s4"…) that say which search found them. */
export async function searchOptions(
  provider: PoiProvider,
  near: LatLng,
  queries: string[],
  prefix: string,
  max: number,
): Promise<MapOptions> {
  const results = await Promise.all(
    queries.map(async (query) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS)
      try {
        return { query, pois: await provider.searchText(query, near, controller.signal, { language: 'en', limit: 10 }) }
      } catch {
        return { query, pois: [] as Poi[] }
      } finally {
        clearTimeout(timer)
      }
    }),
  )
  const options: MapOption[] = []
  const pois: Record<string, Poi> = {}
  const seen = new Set<string>()
  for (const { query, pois: found } of results) {
    for (const poi of found) {
      if (seen.has(poi.key) || options.length >= max) continue
      seen.add(poi.key)
      const id = `${prefix}${options.length + 1}`
      pois[id] = poi
      options.push({
        id,
        name: poi.name,
        ...(poi.rating != null ? { rating: poi.rating } : {}),
        ...(poi.address ? { address: poi.address } : {}),
        foundBy: query,
      })
    }
  }
  return { options, pois }
}

/**
 * Real restaurants around the day's area, for the planner to choose meals from (so it never makes one
 * up). With a food wish, only places that fit it; everyday places only when hardly any were found.
 */
export async function findRestaurants(provider: PoiProvider | null, near: LatLng | null, wishes: string): Promise<MapOptions> {
  if (!provider || !near) return { options: [], pois: {} }
  const diet = dietOf(wishes)
  const cafes = /קפה|cafe/i.test(wishes) ? ['cafe'] : []
  const found = await searchOptions(provider, near, [...(diet ? DIET_QUERIES[diet] : ['popular restaurant']), ...cafes], 'r', 30)
  if (!diet || found.options.length >= 3) return found
  const more = await searchOptions(provider, near, ['popular restaurant'], `r${found.options.length}-`, 20)
  return { options: [...found.options, ...more.options], pois: { ...found.pois, ...more.pois } }
}

/** Real sights around the day's area, evening spots included, shaped by what they feel like doing. */
export async function findSights(provider: PoiProvider | null, near: LatLng | null, wishes: string): Promise<MapOptions> {
  if (!provider || !near) return { options: [], pois: {} }
  const queries = [
    'top tourist attractions',
    'night view observation deck',
    ...(/חיי לילה|nightlife|בר/i.test(wishes) ? ['izakaya alley nightlife'] : []),
    ...(/קניות|shopping/i.test(wishes) ? ['shopping street'] : []),
    ...(/מוזיאונ|אמנות|museum/i.test(wishes) ? ['museum'] : []),
    ...(/טבע|נוף|nature/i.test(wishes) ? ['garden park'] : []),
    ...(/אנימה|גיימינג|anime/i.test(wishes) ? ['anime shops arcade'] : []),
  ]
  return searchOptions(provider, near, queries, 's', 30)
}
