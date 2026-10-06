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

/** Free on the Firebase Spark plan (Gemini Developer API). */
const MODEL = 'gemini-3.8-flash'

const SYSTEM = `You are the travel assistant inside "Tabi", a Hebrew app for a group trip to Japan.
The user writes (usually in Hebrew) a place in Japan they want to visit: a name, a description ("the shrine with thousands of orange gates"), or a wish ("good ramen near Shibuya").
Identify real, existing places in Japan only. Never invent places.
- A specific place: return exactly that one place.
- A wish or category: return up to 3 well-known, well-reviewed options, best first. Prefer places near the map position when the user says "near here" or gives no area.
- Not in Japan, or too unclear: return no places and ask one short clarifying question.
For every place give: "name" in Hebrew as Israelis would write it; "searchName" = the official English (romaji) name exactly as on maps; "city" in English; approximate "lat"/"lng"; a category; and "why" = one short Hebrew sentence on what makes it worth visiting.
"reply" is one short, friendly Hebrew sentence that introduces the results. Plain text, no markdown.`

let modelPromise: Promise<import('firebase/ai').GenerativeModel> | null = null

function getModel() {
  modelPromise ??= Promise.all([import('firebase/app'), import('firebase/ai')]).then(([{ getApp }, ai]) => {
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
    return ai.getGenerativeModel(ai.getAI(getApp(), { backend: new ai.GoogleAIBackend() }), {
      model: MODEL,
      systemInstruction: SYSTEM,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: Schema.object({ properties: { reply: Schema.string(), places: Schema.array({ items: place }) } }),
        temperature: 0.4,
      },
    })
  })
  return modelPromise
}

export async function askAssistant(text: string, near: LatLng | null): Promise<AssistantAnswer> {
  const model = await getModel()
  const where = near ? `\n(The map is currently around lat ${near.lat.toFixed(4)}, lng ${near.lng.toFixed(4)}.)` : ''
  const result = await model.generateContent(text + where)
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

/**
 * Pins the assistant's place to a real map entry (exact position, address, opening hours) by searching
 * the map provider near the approximate coordinates; falls back to those coordinates.
 */
export async function resolveOnMap(place: AssistantPlace, provider: PoiProvider | null, signal: AbortSignal): Promise<Poi> {
  const fallback: Poi = {
    key: `ai:${place.location.lat.toFixed(5)},${place.location.lng.toFixed(5)}`,
    source: 'osm',
    name: place.name,
    category: place.category,
    location: place.location,
    address: place.city,
  }
  if (!provider) return fallback
  try {
    for (const query of [`${place.searchName} ${place.city}`, place.searchName]) {
      const suggestions = await provider.suggest(query, place.location, signal)
      for (const suggestion of suggestions.slice(0, 4)) {
        const poi = await suggestion.resolve()
        if (poi && distanceMeters(poi.location, place.location) < 6000) {
          return { ...poi, name: place.name, category: poi.category === 'other' ? place.category : poi.category }
        }
      }
    }
  } catch (error) {
    if (signal.aborted) throw error
  }
  return fallback
}
