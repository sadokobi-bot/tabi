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
  /** Street address when the source gave one (imported posts); sharpens the map match. */
  address?: string
}

export interface AssistantAnswer {
  reply: string
  places: AssistantPlace[]
}

const CATEGORY_IDS: CategoryId[] = ['attraction', 'amusement', 'food', 'cafe', 'shopping', 'nightlife', 'nature', 'hotel', 'transport', 'other']

/**
 * Free on the Firebase Spark plan (Gemini Developer API), tried in order: the free tier sometimes
 * answers "high demand", and older models retire (gemini-3.5-flash: May 2027).
 */
const MODELS = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']
/**
 * Reading a post is transcription, not reasoning: flash-lite with minimal thinking takes ~3 s where
 * the larger models take ~35 s on a screenshot. Retires no earlier than July 2027; the rest are the fallback.
 */
const IMPORT_MODELS: { model: string; fast?: boolean }[] = [
  { model: 'gemini-3.5-flash-lite', fast: true },
  { model: 'gemini-3.8-flash' },
  { model: 'gemini-3.5-flash' },
]

const SYSTEM = `You are the travel assistant inside "Tabi", a Hebrew app for a group trip to Japan.
The user writes (usually in Hebrew) a place in Japan they want to visit: a name, a description ("the shrine with thousands of orange gates"), or a wish ("good ramen near Shibuya").
Identify real, existing places in Japan only. Never invent places.
- A specific place: return exactly that one place.
- A wish or category: return up to 3 well-known, well-reviewed options, best first. Prefer places near the map position when the user says "near here" or gives no area.
- Not in Japan, or too unclear: return no places and ask one short clarifying question.
For every place give: "name" in Hebrew as Israelis would write it; "searchName" = the official English (romaji) name exactly as on maps; "city" in English; approximate "lat"/"lng"; a category; and "why" = one short Hebrew sentence on what makes it worth visiting.
"reply" is one short, friendly Hebrew sentence that introduces the results. Plain text, no markdown.`

const IMPORT_SYSTEM = `You read a social-media post (a screenshot or pasted text, often Hebrew) that recommends places in Japan, for "Tabi", a Hebrew trip app.
Extract every place the post recommends, in the post's order. Ignore app interface text, usernames, likes and comments. Never add places the post does not mention. At most 15.
For each place: "name" exactly as the post writes it; "searchName" = the official English (romaji) name as it appears on maps; "address" = the address the post gives, copied as-is, or "" when there is none; "city" in English; approximate "lat"/"lng"; a category; and "note" = what the post says about the place, in Hebrew, 1-2 short sentences that keep its concrete tips (dishes to order, timing, prices).
"reply" is one short Hebrew sentence saying how many places were found. Plain text, no markdown.`

type ModelKind = 'ask' | 'import'
const modelsByKind = new Map<ModelKind, Promise<import('firebase/ai').GenerativeModel[]>>()

function getModels(kind: ModelKind) {
  let models = modelsByKind.get(kind)
  if (!models) {
    models = Promise.all([import('firebase/app'), import('firebase/ai')]).then(([{ getApp }, ai]) => {
      const { Schema } = ai
      const common = {
        name: Schema.string(),
        searchName: Schema.string(),
        city: Schema.string(),
        lat: Schema.number(),
        lng: Schema.number(),
        category: Schema.enumString({ enum: CATEGORY_IDS }),
      }
      const place = Schema.object({
        properties: kind === 'ask' ? { ...common, why: Schema.string() } : { ...common, address: Schema.string(), note: Schema.string() },
      })
      const instance = ai.getAI(getApp(), { backend: new ai.GoogleAIBackend() })
      const responseSchema = Schema.object({ properties: { reply: Schema.string(), places: Schema.array({ items: place }) } })
      const list = kind === 'ask' ? MODELS.map((model) => ({ model, fast: false })) : IMPORT_MODELS
      return list.map(({ model, fast }) =>
        ai.getGenerativeModel(instance, {
          model,
          systemInstruction: kind === 'ask' ? SYSTEM : IMPORT_SYSTEM,
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: kind === 'ask' ? 0.4 : 0.2,
            ...(fast ? { thinkingConfig: { thinkingLevel: ai.ThinkingLevel.MINIMAL } } : {}),
          },
        }),
      )
    })
    modelsByKind.set(kind, models)
  }
  return models
}

type Prompt = string | (string | { inlineData: { data: string; mimeType: string } })[]

/** Why a request failed, in terms the UI can explain. */
export type AssistantFailure = 'disabled' | 'quota' | 'busy' | 'other'

export function failureOf(error: unknown): AssistantFailure {
  const text = `${(error as { code?: string } | null)?.code ?? ''} ${(error as Error | null)?.message ?? ''}`
  if (text.includes('api-not-enabled')) return 'disabled'
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(text)) return 'quota'
  if (/50[03]|high demand|overloaded|unavailable/i.test(text)) return 'busy'
  return 'other'
}

/**
 * Tries each model in turn. The free tier caps requests per minute and per day for each model,
 * so when every model is limited or busy, wait a few seconds and go round once more.
 */
async function generate(kind: ModelKind, prompt: Prompt) {
  let lastError: unknown
  for (let round = 0; round < 2; round++) {
    if (round > 0) await new Promise((resolve) => setTimeout(resolve, 6000))
    for (const model of await getModels(kind)) {
      try {
        return await model.generateContent(prompt)
      } catch (error) {
        lastError = error
        // Not enabled in the Firebase project: no other model will work either.
        if (failureOf(error) === 'disabled') throw error
      }
    }
    if (failureOf(lastError) === 'other') break
  }
  throw lastError
}

export async function askAssistant(text: string, near: LatLng | null): Promise<AssistantAnswer> {
  const where = near ? `\n(The map is currently around lat ${near.lat.toFixed(4)}, lng ${near.lng.toFixed(4)}.)` : ''
  const result = await generate('ask', text + where)
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

/** An image ready for Gemini: base64 JPEG without the data-URL prefix. */
export interface PromptImage {
  data: string
  mimeType: string
}

/** Every place a shared post (screenshot and/or pasted text) recommends, with its notes in Hebrew. */
export async function extractPlaces(text: string, image: PromptImage | null): Promise<AssistantAnswer> {
  const instruction = text.trim() ? `Extract the places from this post:
${text.trim()}` : 'Extract the places from this post.'
  const result = await generate('import', image ? [instruction, { inlineData: image }] : instruction)
  const json = JSON.parse(result.response.text()) as {
    reply?: string
    places?: { name: string; searchName: string; address?: string; city: string; lat: number; lng: number; category: string; note?: string }[]
  }
  return {
    reply: json.reply ?? '',
    places: (json.places ?? []).slice(0, 15).map((p) => ({
      name: p.name,
      searchName: p.searchName,
      city: p.city,
      category: CATEGORY_IDS.includes(p.category as CategoryId) ? (p.category as CategoryId) : 'other',
      location: { lat: p.lat, lng: p.lng },
      why: p.note ?? '',
      ...(p.address?.trim() ? { address: p.address.trim() } : {}),
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
const MAX_DISTANCE_M = 2000

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

  // Google's own ranking is reliable, and every resolve is a billed Place Details call: take its top hit.
  if (provider.id === 'google') {
    try {
      const [top] = await provider.suggest(`${place.searchName} ${place.address ?? place.city}`, place.location, signal)
      const poi = top ? await top.resolve() : null
      if (poi && distanceMeters(poi.location, place.location) <= MAX_DISTANCE_M) return { ...poi, name: place.name }
    } catch (error) {
      if (signal.aborted) throw error
    }
    return fallback
  }

  let best: { poi: Poi; score: number } | null = null
  try {
    for (const query of [`${place.searchName} ${place.address ?? place.city}`, `${place.searchName} ${place.city}`, place.searchName]) {
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
