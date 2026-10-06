import type { CategoryId, LatLng } from '@/data/types'
import type { Poi, PoiProvider } from '@/maps/poi'
import { distanceMeters } from '@/lib/geo'

/** A place the assistant thinks the user means. Coordinates are approximate until resolved on the map. */
export interface AssistantPlace {
  name: string
  searchName: string
  city: string
  category: CategoryId
  location: LatLng
  why: string
}

export interface AssistantAnswer {
  reply: string
  places: AssistantPlace[]
}

const CATEGORY_IDS: CategoryId[] = ['attraction', 'food', 'cafe', 'shopping', 'nightlife', 'nature', 'hotel', 'transport', 'other']

/**
 * Free on the Firebase Spark plan (Gemini Developer API), tried in order: the free tier sometimes
 * answers "high demand", and older models retire (gemini-3.5-flash: May 2027).
 */
const MODELS = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']

const SYSTEM = `You are the travel assistant inside "Tabi", a Hebrew app for a group trip to Japan.
The user writes (usually in Hebrew) a place in Japan they want to visit: a name, a description ("the shrine with thousands of orange gates"), or a wish ("good ramen near Shibuya").
Identify real, existing places in Japan only. Never invent places.
- A specific place: return exactly that one place.
- A wish or category: return up to 3 well-known, well-reviewed options, best first. Prefer places near the map position when the user says "near here" or gives no area.
- Not in Japan, or too unclear: return no places and ask one short clarifying question.
For every place give: "name" in Hebrew as Israelis would write it; "searchName" = the official English (romaji) name exactly as on maps; "city" in English; approximate "lat"/"lng"; a category; and "why" = one short Hebrew sentence on what makes it worth visiting.
"reply" is one short, friendly Hebrew sentence that introduces the results. Plain text, no markdown.`

let modelsPromise: Promise<import('firebase/ai').GenerativeModel[]> | null = null

function getModels() {
  modelsPromise ??= Promise.all([import('firebase/app'), import('firebase/ai')]).then(([{ getApp }, ai]) => {
    const { Schema } = ai
    const place = Schema.object({
      properties: {
        name: Schema.string(),
        searchName: Schema.string(),
        city: Schema.string(),
        lat: Schema.number(),
        lng: Schema.number(),
        category: Schema.enumString({ enum: CATEGORY_IDS }),
        why: Schema.string(),
      },
    })
    const instance = ai.getAI(getApp(), { backend: new ai.GoogleAIBackend() })
    const responseSchema = Schema.object({ properties: { reply: Schema.string(), places: Schema.array({ items: place }) } })
    return MODELS.map((model) =>
      ai.getGenerativeModel(instance, {
        model,
        systemInstruction: SYSTEM,
        generationConfig: { responseMimeType: 'application/json', responseSchema, temperature: 0.4 },
      }),
    )
  })
  return modelsPromise
}

async function generate(prompt: string) {
  let lastError: unknown
  for (const model of await getModels()) {
    try {
      return await model.generateContent(prompt)
    } catch (error) {
      lastError = error
      // Not enabled in the Firebase project: no other model will work either.
      if (String((error as { code?: string } | null)?.code).includes('api-not-enabled')) break
    }
  }
  throw lastError
}

export async function askAssistant(text: string, near: LatLng | null): Promise<AssistantAnswer> {
  const where = near ? `\n(The map is currently around lat ${near.lat.toFixed(4)}, lng ${near.lng.toFixed(4)}.)` : ''
  const result = await generate(text + where)
  const json = JSON.parse(result.response.text()) as {
    reply?: string
    places?: { name: string; searchName: string; city: string; lat: number; lng: number; category: string; why: string }[]
  }
  return {
    reply: json.reply ?? '',
    places: (json.places ?? []).slice(0, 3).map((p) => ({
      name: p.name,
      searchName: p.searchName,
      city: p.city,
      category: CATEGORY_IDS.includes(p.category as CategoryId) ? (p.category as CategoryId) : 'other',
      location: { lat: p.lat, lng: p.lng },
      why: p.why,
    })),
  }
}

const words = (text: string) =>
  new Set(
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  )

/** Share of words the two names have in common (0–1). */
function nameMatch(a: string, b: string): number {
  const x = words(a)
  const y = words(b)
  const shared = [...x].filter((w) => y.has(w)).length
  return shared / (new Set([...x, ...y]).size || 1)
}

/** Gemini's coordinates are approximate; a map entry this far away is a different place. */
const MAX_DISTANCE_M = 5000

/**
 * Pins the assistant's place to a real map entry (exact position, address, opening hours).
 * Candidates near the approximate coordinates are scored by name, kind and distance, so "Meiji Jingu"
 * finds the shrine rather than the nearby Meiji Jingu Stadium. Without a good match it falls back to
 * Gemini's coordinates, marked as approximate.
 */
export async function resolveOnMap(place: AssistantPlace, provider: PoiProvider | null, signal: AbortSignal): Promise<Poi> {
  const fallback: Poi = {
    key: `ai:${place.location.lat.toFixed(5)},${place.location.lng.toFixed(5)}`,
    source: 'osm',
    name: place.name,
    category: place.category,
    location: place.location,
    address: `${place.city} · מיקום משוער`,
  }
  if (!provider) return fallback

  let best: { poi: Poi; score: number } | null = null
  try {
    for (const query of [`${place.searchName} ${place.city}`, place.searchName]) {
      const suggestions = await provider.suggest(query, place.location, signal)
      for (const suggestion of suggestions.slice(0, 6)) {
        const poi = await suggestion.resolve()
        if (!poi) continue
        const distance = distanceMeters(poi.location, place.location)
        const match = nameMatch(place.searchName, poi.name)
        if (distance > MAX_DISTANCE_M || match < 0.34) continue
        const score = match + (poi.category === place.category ? 0.5 : 0) - (distance / 1000) * 0.15
        if (!best || score > best.score) best = { poi, score }
      }
    }
  } catch (error) {
    if (signal.aborted) throw error
  }
  if (!best) return fallback
  const { poi } = best
  return { ...poi, name: place.name, category: poi.category === 'other' ? place.category : poi.category }
}
