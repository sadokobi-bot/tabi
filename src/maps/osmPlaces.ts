import type { Bounds, CategoryId } from '@/data/types'
import { boundsKey, boundsToCircle } from '@/lib/geo'
import { dedupePois, type Poi, type PoiProvider, type Suggestion } from './poi'

/**
 * Free, key-less provider built on OpenStreetMap data:
 * - Overpass API for "recommended nearby" (notable places are ranked first via their Wikidata link)
 * - Photon (komoot) for type-ahead search
 */

/** Public Overpass instances, tried in order: the main one is occasionally overloaded (HTTP 504). */
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
const OVERPASS_ATTEMPT_TIMEOUT_MS = 12_000
const PHOTON_URL = 'https://photon.komoot.io/api/'
const JAPAN_BBOX = '122.9,24.0,154.0,45.6'
/** OSM is dense: keep area queries to roughly a neighbourhood. */
const MAX_AREA_RADIUS_M = 3_500
const CACHE_TTL_MS = 10 * 60_000
const PER_CATEGORY_LIMIT = 25

type Tags = Record<string, string | undefined>

const FILTERS: Partial<Record<CategoryId, string[]>> = {
  attraction: [
    '["tourism"~"^(attraction|museum|viewpoint|gallery|theme_park|zoo|aquarium)$"]["name"]',
    '["amenity"="place_of_worship"]["name"]["wikidata"]',
    '["historic"]["name"]["wikidata"]',
  ],
  food: ['["amenity"~"^(restaurant|fast_food|food_court)$"]["name"]'],
  cafe: ['["amenity"="cafe"]["name"]'],
  shopping: ['["shop"~"^(mall|department_store)$"]["name"]', '["amenity"="marketplace"]["name"]'],
  nightlife: ['["amenity"~"^(bar|pub|nightclub)$"]["name"]'],
  nature: ['["leisure"~"^(park|garden|nature_reserve)$"]["name"]["wikidata"]', '["natural"~"^(peak|beach|waterfall)$"]["name"]'],
  hotel: ['["tourism"~"^(hotel|hostel|guest_house)$"]["name"]'],
  transport: ['["railway"="station"]["name"]'],
}

export function categoryFromOsmTags(tags: Tags): CategoryId {
  const { tourism, amenity, historic, shop, leisure, natural, railway } = tags
  if (railway === 'station') return 'transport'
  if (tourism && /^(attraction|museum|viewpoint|gallery|theme_park|zoo|aquarium)$/.test(tourism)) return 'attraction'
  if (amenity === 'place_of_worship' || historic) return 'attraction'
  if (amenity && /^(restaurant|fast_food|food_court)$/.test(amenity)) return 'food'
  if (amenity === 'cafe') return 'cafe'
  if (amenity && /^(bar|pub|nightclub|biergarten)$/.test(amenity)) return 'nightlife'
  if ((shop && /^(mall|department_store)$/.test(shop)) || amenity === 'marketplace') return 'shopping'
  if (shop) return 'shopping'
  if ((leisure && /^(park|garden|nature_reserve)$/.test(leisure)) || natural) return 'nature'
  if (tourism && /^(hotel|hostel|guest_house|motel)$/.test(tourism)) return 'hotel'
  return 'other'
}

export function osmDisplayName(tags: Tags): string | undefined {
  return tags['name:he'] ?? tags['name:en'] ?? tags.name
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Tags
}

function toPoi(element: OverpassElement): Poi | null {
  const tags = element.tags ?? {}
  const name = osmDisplayName(tags)
  const lat = element.lat ?? element.center?.lat
  const lng = element.lon ?? element.center?.lon
  if (!name || lat == null || lng == null) return null
  const osmId = `${element.type}/${element.id}`
  return {
    key: `osm:${osmId}`,
    source: 'osm',
    name,
    category: categoryFromOsmTags(tags),
    location: { lat, lng },
    address: [tags['addr:city'], tags['addr:quarter'] ?? tags['addr:suburb']].filter(Boolean).join(', ') || undefined,
    osmId,
    extras: {
      website: tags.website ?? tags['contact:website'],
      phone: tags.phone ?? tags['contact:phone'],
      openingHours: tags.opening_hours,
      cuisine: tags.cuisine?.replaceAll(';', ', '),
    },
  }
}

/** Notable first: has a Wikidata/Wikipedia entry, then richer tagging. */
function notability(element: OverpassElement): number {
  const tags = element.tags ?? {}
  return (tags.wikidata ? 4 : 0) + (tags.wikipedia ? 2 : 0) + (tags['name:en'] ? 1 : 0) + (tags.website ? 1 : 0)
}

const areaCache = new Map<string, { at: number; pois: Poi[] }>()

/** Runs an Overpass query, falling back to the next instance on errors, timeouts or non-JSON replies. */
async function fetchOverpass(query: string, signal: AbortSignal): Promise<{ elements?: OverpassElement[] }> {
  let lastError: unknown = new Error('Overpass unavailable')
  for (const endpoint of OVERPASS_ENDPOINTS) {
    if (signal.aborted) break
    const attempt = new AbortController()
    const abortAttempt = () => attempt.abort()
    signal.addEventListener('abort', abortAttempt)
    const timer = setTimeout(abortAttempt, OVERPASS_ATTEMPT_TIMEOUT_MS)
    try {
      const response = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ data: query }), signal: attempt.signal })
      if (!response.ok) throw new Error(`Overpass ${response.status}`)
      return (await response.json()) as { elements?: OverpassElement[] }
    } catch (error) {
      lastError = error
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', abortAttempt)
    }
  }
  throw signal.aborted ? new DOMException('Aborted', 'AbortError') : lastError
}

const PHOTON_TYPE: Record<string, string> = { N: 'node', W: 'way', R: 'relation' }

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_type?: string
    osm_id?: number
    osm_key?: string
    osm_value?: string
    name?: string
    street?: string
    housenumber?: string
    district?: string
    city?: string
    state?: string
  }
}

export const osmProvider: PoiProvider = {
  id: 'osm',

  async searchArea(bounds: Bounds, categories, signal) {
    if (boundsToCircle(bounds).radius > MAX_AREA_RADIUS_M) return { status: 'zoom-in' }

    const cacheKey = `${[...categories].sort().join(',')}:${boundsKey(bounds)}`
    const cached = areaCache.get(cacheKey)
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return { status: 'ok', pois: cached.pois }

    const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`
    const statements = categories.flatMap((category) => FILTERS[category] ?? []).map((filter) => `nwr${filter}(${bbox});`)
    const query = `[out:json][timeout:20];(${statements.join('')});out center 300;`

    const json = await fetchOverpass(query, signal)

    const byCategory = new Map<CategoryId, Poi[]>()
    const sorted = [...(json.elements ?? [])].sort((a, b) => notability(b) - notability(a))
    for (const element of sorted) {
      const poi = toPoi(element)
      if (!poi || !categories.includes(poi.category)) continue
      const list = byCategory.get(poi.category) ?? []
      if (list.length < PER_CATEGORY_LIMIT) list.push(poi)
      byCategory.set(poi.category, list)
    }
    const pois = dedupePois([...byCategory.values()].flat())
    areaCache.set(cacheKey, { at: Date.now(), pois })
    return { status: 'ok', pois }
  },

  async suggest(input, near, signal) {
    const url = new URL(PHOTON_URL)
    url.searchParams.set('q', input)
    url.searchParams.set('limit', '8')
    url.searchParams.set('lang', 'en')
    url.searchParams.set('bbox', JAPAN_BBOX)
    if (near) {
      url.searchParams.set('lat', String(near.lat))
      url.searchParams.set('lon', String(near.lng))
    }
    const response = await fetch(url, { signal })
    if (!response.ok) throw new Error(`Photon ${response.status}`)
    const json = (await response.json()) as { features?: PhotonFeature[] }

    return (json.features ?? []).flatMap((feature): Suggestion[] => {
      const p = feature.properties
      const title = p.name ?? [p.street, p.housenumber].filter(Boolean).join(' ')
      if (!title) return []
      const [lng, lat] = feature.geometry.coordinates
      const osmId = p.osm_type && p.osm_id ? `${PHOTON_TYPE[p.osm_type] ?? 'node'}/${p.osm_id}` : undefined
      const subtitle = [p.district, p.city, p.state].filter(Boolean).join(', ') || undefined
      const poi: Poi = {
        key: osmId ? `osm:${osmId}` : `osm:${lat},${lng}`,
        source: 'osm',
        name: title,
        category: p.osm_key ? categoryFromOsmTags({ [p.osm_key]: p.osm_value }) : 'other',
        location: { lat, lng },
        address: subtitle,
        osmId,
      }
      return [{ key: poi.key, title, subtitle, resolve: async () => poi }]
    })
  },

  async details() {
    return null
  },
}
