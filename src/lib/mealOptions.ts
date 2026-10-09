import type { LatLng } from '@/data/types'
import type { Poi, PoiProvider } from '@/maps/poi'
import type { RestaurantOption } from './assistant'

export type Diet = 'kosher' | 'vegan' | 'vegetarian'

/** A food wish in the travellers' own words. */
export function dietOf(text: string): Diet | null {
  if (/כשר|kosher/i.test(text)) return 'kosher'
  if (/טבעונ|vegan/i.test(text)) return 'vegan'
  if (/צמחונ|vegetarian/i.test(text)) return 'vegetarian'
  return null
}

const DIET_QUERIES: Record<Diet, string[]> = {
  // Kosher places in Japan are few: the plant-based ones are the fallback.
  kosher: ['kosher restaurant', 'vegan restaurant', 'vegetarian restaurant'],
  vegan: ['vegan restaurant', 'vegetarian restaurant'],
  vegetarian: ['vegetarian restaurant', 'vegan restaurant'],
}

const SEARCH_TIMEOUT_MS = 8000
const MAX_OPTIONS = 30

/**
 * Real restaurants around the day's area, for the planner to choose meals from (so it never makes one
 * up). The searches follow the food wishes; each option says which search found it.
 */
export async function findRestaurants(
  provider: PoiProvider | null,
  near: LatLng | null,
  wishes: string,
): Promise<{ options: RestaurantOption[]; pois: Record<string, Poi> }> {
  if (!provider || !near) return { options: [], pois: {} }
  const diet = dietOf(wishes)
  const search = (queries: string[]) =>
    Promise.all(
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
  const cafes = /קפה|cafe/i.test(wishes) ? ['cafe'] : []
  // With a food wish, only places that fit it (so no meal can slip outside it); everyday places only
  // when hardly any were found.
  let results = await search([...(diet ? DIET_QUERIES[diet] : ['popular restaurant']), ...cafes])
  if (diet && results.reduce((count, { pois }) => count + pois.length, 0) < 3)
    results = [...results, ...(await search(['popular restaurant']))]

  const options: RestaurantOption[] = []
  const pois: Record<string, Poi> = {}
  const seen = new Set<string>()
  for (const { query, pois: found } of results) {
    for (const poi of found) {
      if (seen.has(poi.key) || options.length >= MAX_OPTIONS) continue
      seen.add(poi.key)
      const id = `r${options.length + 1}`
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
