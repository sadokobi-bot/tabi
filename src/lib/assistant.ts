import type { CategoryId, LatLng } from '@/data/types'
import type { Poi, PoiProvider } from '@/maps/poi'
import { distanceMeters } from '@/lib/geo'
import { nameMatch } from './names'

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
  /** English Google Maps query for what the user asked ("wagyu restaurant Shinjuku Tokyo"). */
  googleQuery?: string
  /** Center of the area the user named, if any. */
  area?: LatLng
}

const CATEGORY_IDS: CategoryId[] = [
  'attraction',
  'amusement',
  'food',
  'cafe',
  'shopping',
  'nightlife',
  'nature',
  'hotel',
  'transport',
  'other',
]

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
"reply" is one short, friendly Hebrew sentence that introduces the results. Plain text, no markdown.
Also give "googleQuery": the English phrase to type into Google Maps to find what the user wants, e.g. "wagyu restaurant", "ramen Shibuya Tokyo", "Fushimi Inari Taisha Kyoto". Include the area only when the user named one. And "areaLat"/"areaLng": the center of the area the user named, or 0/0 when they named none.`

const IMPORT_SYSTEM = `You read a social-media post (a screenshot or pasted text, often Hebrew) that recommends places in Japan, for "Tabi", a Hebrew trip app.
Extract every place the post recommends, in the post's order. Ignore app interface text, usernames, likes and comments. Never add places the post does not mention. At most 15.
For each place: "name" exactly as the post writes it; "searchName" = the official English (romaji) name as it appears on maps; "address" = the address the post gives, copied as-is, or "" when there is none; "city" in English; approximate "lat"/"lng"; a category; and "note" = what the post says about the place, in Hebrew, 1-2 short sentences that keep its concrete tips (dishes to order, timing, prices).
"reply" is one short Hebrew sentence saying how many places were found. Plain text, no markdown.`

const PLAN_SYSTEM = `You plan one day of a trip in Japan for "Tabi", a Hebrew app for a group trip.
You get the area, the date, what the travellers feel like (Hebrew, may be empty), the places they already saved nearby (id, name, category), the stops already fixed that day, where they sleep, and real places found on the map nearby: restaurants and sights.
Build a realistic, enjoyable day from about 09:00 until about 21:30. Evenings in Japan are great, so the day doesn't end at dinner:
- A full day has 6-7 stops: a morning sight, lunch, one or two afternoon stops, dinner around 19:00-20:00, and one evening stop after dinner (a night view, an illuminated area, a lively street or izakaya alley, a night market). A relaxed day has 4-5 stops with longer visits, and still ends after dinner.
- Order the stops geographically so the day flows with little back-and-forth, starting near where they sleep when given.
- Prefer their saved places when they fit (put the place's id in "savedId").
- Sights: prefer "Real sights nearby" (put its id in "mapId"). Any other sight must be a world-famous, existing place, with its official English name in "searchName". Never invent places.
- Meals, cafes and bars: choose ONLY from "Real restaurants nearby" (its id in "mapId") or from their saved places. Never name a restaurant that is not in those lists, even a famous-sounding one. If the list is empty, plan the day without meal stops.
- Food wishes (kosher, vegetarian, vegan…) apply to EVERY meal of the day. Only a list entry that clearly fits counts (for kosher: its name says kosher or Chabad, or it is known to be kosher). Kosher places are rare in Japan: when the list has one, use it for at least one meal (dinner if possible) even if it is a train ride away, and plan the day's route around it. If they asked for kosher and no entry is kosher, every meal must be a vegetarian or vegan entry; each such stop's "why" says what to order there. Don't write about kosher or food wishes in "reply" (it describes the sights): the app tells them itself.
- Exactly two meals, lunch and dinner (unless fixed stops already cover one), plus at most one cafe or snack stop.
- Include every fixed stop in your list, at its time (or where it fits best when it has none), with its id in "savedId", and plan around them.
- Never suggest a place listed as already planned on other days, and never list the same place twice.
- Respect typical opening hours (shrines and markets in the morning, viewpoints at sunset, bars at night) and leave realistic travel time.
- When a "Current plan" and a "Change request" are given, return the whole revised day: do exactly what the change request asks, keep every other stop as it is (same place, same ids, same time unless the change needs it), and keep the day going until the evening.
For every stop: "time" as HH:mm (24h); "name" in Hebrew as Israelis would write it; "searchName" = the official English (romaji) name as on maps; "city" in English; approximate "lat"/"lng"; a category; "why" = one short Hebrew sentence (what to do or eat there).
"reply" is one short Hebrew sentence with the idea of the day. Plain text, no markdown. Write Hebrew text in Hebrew letters only: never Arabic or any other script inside a Hebrew word.`

const TRANSLATE_SYSTEM = `You help Israeli travellers in Japan read what's in front of them, for "Tabi", a Hebrew app.
You get a photo: usually a restaurant menu, sometimes a sign, a ticket machine, a notice or a product label. Mostly Japanese.
- "kind": menu, sign, product (packaging / label) or other.
- "title": one short Hebrew line saying what this is ("תפריט של מסעדת ראמן", "שלט הוראות בכניסה למקדש").
- "summary": 1-2 short Hebrew sentences with what matters most (for a sign: what it asks or warns; for a menu: what the place serves and anything notable, like a set-meal deal or how to order).
- "items": for a menu, every dish or drink you can read, in order (at most 40); for other images, the important lines. For each: "original" = the text as printed; "hebrew" = a natural Hebrew name (for dishes, what it is, not a literal translation); "note" = one short Hebrew sentence on what it is or tastes like, or "" when obvious; "price" = as printed (e.g. "¥980") or ""; "tags" = only what you can tell with confidence about a food item: spicy, pork, beef, chicken, seafood, raw, vegetarian, alcohol, sweet. "vegetarian" only when the dish is clearly free of meat and fish, broth included (ramen and dashi-based soups usually are not); when a typical recipe has hidden pork, beef or fish (broth, bonito flakes, lard), tag it. No tags for non-food items.
Write Hebrew text in Hebrew letters only. Never invent items that aren't in the photo; if the photo is unreadable, say so in "summary" and return no items.`

const RAIN_SYSTEM = `You adapt one day of a trip in Japan to rain, for "Tabi", a Hebrew app for a group trip.
You get the area, the date, when rain is expected, the day's stops (id, time, name, category), the places the travellers saved nearby (id, name, category) and where they sleep.
- Decide for each stop whether it is mostly outdoors: parks and gardens, shrine and temple grounds (Fushimi Inari, Meiji Jingu, Kiyomizu-dera…), viewpoints and observation decks open to the sky, walking streets and districts, open-air markets, zoos, hiking, boat rides, mostly-outdoor theme parks. Museums, aquariums, malls, department stores, covered shopping arcades, restaurants, cafes, indoor attractions (teamLab, arcades), onsen and observatories with indoor decks are fine in rain.
- For every outdoor stop at a rainy time (or with no time, when it rains most of the day), suggest ONE indoor alternative close to it (same neighbourhood, ideally within 2 km) that fits the same time slot and the spirit of the day. Put the replaced stop's id in "replaceId".
- Prefer a place they saved when one fits (its id in "savedId"); otherwise real, existing, well-known places only ("savedId" = ""). Never invent places, never suggest a place listed as already planned on other days, and never suggest a stop already in the day.
- Keep indoor stops as they are: return only replacements. If nothing needs changing, return no places.
For every replacement: "replaceId"; "time" = the replaced stop's time as HH:mm (or a sensible time when it had none); "name" in Hebrew as Israelis would write it; "searchName" = the official English (romaji) name as on maps; "city" in English; approximate "lat"/"lng"; a category; "why" = one short Hebrew sentence on why it is great on a rainy day.
"reply" is one short Hebrew sentence summing up the rainy-day plan. Plain text, no markdown. Write Hebrew text in Hebrew letters only.`

type ModelKind = 'ask' | 'import' | 'plan' | 'translate' | 'rain'

/** What a dish is, as far as a menu photo tells (for allergies, kosher and taste). */
export const FOOD_TAGS = ['spicy', 'pork', 'beef', 'chicken', 'seafood', 'raw', 'vegetarian', 'alcohol', 'sweet'] as const
export type FoodTag = (typeof FOOD_TAGS)[number]

export interface Translation {
  kind: 'menu' | 'sign' | 'product' | 'other'
  title: string
  summary: string
  items: { original: string; hebrew: string; note: string; price: string; tags: FoodTag[] }[]
}

/** Reads a photo (menu, sign, label) and explains it in Hebrew. */
export async function translateImage(image: PromptImage, question: string): Promise<Translation> {
  const prompt = question.trim()
    ? `Translate and explain this photo. The traveller also asks: ${question.trim()}`
    : 'Translate and explain this photo.'
  const result = await generate('translate', [prompt, { inlineData: image }])
  const json = JSON.parse(result.response.text()) as Partial<Translation>
  return {
    kind: json.kind ?? 'other',
    title: cleanText(json.title),
    summary: cleanText(json.summary),
    items: (json.items ?? []).slice(0, 40).map((item) => ({
      original: item.original ?? '',
      hebrew: cleanText(item.hebrew, item.original ?? ''),
      note: cleanText(item.note),
      price: item.price ?? '',
      tags: (item.tags ?? []).filter((tag): tag is FoodTag => (FOOD_TAGS as readonly string[]).includes(tag)),
    })),
  }
}
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
        properties:
          kind === 'ask'
            ? { ...common, why: Schema.string() }
            : kind === 'plan'
              ? { ...common, why: Schema.string(), time: Schema.string(), savedId: Schema.string(), mapId: Schema.string() }
              : kind === 'rain'
                ? { ...common, why: Schema.string(), time: Schema.string(), savedId: Schema.string(), replaceId: Schema.string() }
                : { ...common, address: Schema.string(), note: Schema.string() },
      })
      const instance = ai.getAI(getApp(), { backend: new ai.GoogleAIBackend() })
      const responseSchema =
        kind === 'translate'
          ? Schema.object({
              properties: {
                kind: Schema.enumString({ enum: ['menu', 'sign', 'product', 'other'] }),
                title: Schema.string(),
                summary: Schema.string(),
                items: Schema.array({
                  items: Schema.object({
                    properties: {
                      original: Schema.string(),
                      hebrew: Schema.string(),
                      note: Schema.string(),
                      price: Schema.string(),
                      tags: Schema.array({ items: Schema.enumString({ enum: [...FOOD_TAGS] }) }),
                    },
                  }),
                }),
              },
            })
          : Schema.object({
              properties: {
                reply: Schema.string(),
                places: Schema.array({ items: place }),
                ...(kind === 'ask' ? { googleQuery: Schema.string(), areaLat: Schema.number(), areaLng: Schema.number() } : {}),
              },
            })
      // Reading text off an image is transcription first: the fast models handle it in seconds.
      const list = kind === 'import' || kind === 'translate' ? IMPORT_MODELS : MODELS.map((model) => ({ model, fast: false }))
      return list.map(({ model, fast }) =>
        ai.getGenerativeModel(instance, {
          model,
          systemInstruction: { ask: SYSTEM, plan: PLAN_SYSTEM, import: IMPORT_SYSTEM, translate: TRANSLATE_SYSTEM, rain: RAIN_SYSTEM }[
            kind
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: kind === 'plan' ? 0.7 : kind === 'rain' ? 0.5 : kind === 'ask' ? 0.4 : 0.2,
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

export const FAILURE_TEXT: Record<AssistantFailure, string> = {
  disabled: 'העוזר עוד לא הופעל. בעל הטיול צריך להפעיל את Firebase AI Logic.',
  quota:
    'העוזר הגיע למכסה החינמית של Gemini. נסו שוב בעוד דקה. אם זה חוזר, המכסה היומית נגמרה, והיא מתחדשת כל יום ב-10:00 בבוקר (שעון ישראל).',
  busy: 'העוזר עמוס כרגע. נסו שוב בעוד דקה.',
  other: 'העוזר לא זמין כרגע. נסו שוב בעוד רגע.',
}

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
    googleQuery?: string
    areaLat?: number
    areaLng?: number
  }
  return {
    reply: cleanText(json.reply),
    ...(json.googleQuery?.trim() ? { googleQuery: json.googleQuery.trim() } : {}),
    ...(json.areaLat && json.areaLng ? { area: { lat: json.areaLat, lng: json.areaLng } } : {}),
    places: (json.places ?? []).slice(0, 3).map((p) => ({
      name: cleanText(p.name, p.searchName),
      searchName: p.searchName,
      city: p.city,
      category: CATEGORY_IDS.includes(p.category as CategoryId) ? (p.category as CategoryId) : 'other',
      location: { lat: p.lat, lng: p.lng },
      why: cleanText(p.why),
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
  const instruction = text.trim()
    ? `Extract the places from this post:
${text.trim()}`
    : 'Extract the places from this post.'
  const result = await generate('import', image ? [instruction, { inlineData: image }] : instruction)
  const json = JSON.parse(result.response.text()) as {
    reply?: string
    places?: {
      name: string
      searchName: string
      address?: string
      city: string
      lat: number
      lng: number
      category: string
      note?: string
    }[]
  }
  return {
    reply: cleanText(json.reply),
    places: (json.places ?? []).slice(0, 15).map((p) => ({
      name: cleanText(p.name, p.searchName),
      searchName: p.searchName,
      city: p.city,
      category: CATEGORY_IDS.includes(p.category as CategoryId) ? (p.category as CategoryId) : 'other',
      location: { lat: p.lat, lng: p.lng },
      why: cleanText(p.note),
      ...(p.address?.trim() ? { address: p.address.trim() } : {}),
    })),
  }
}

/** One stop of an AI-planned day. `savedId` points at one of the trip's saved places when it picked one. */
export interface PlannedStop extends AssistantPlace {
  time: string
  savedId?: string
  /** One of the real places it was given (by id). */
  mapId?: string
}

/** A real place found on the map near the day's area, offered to the planner. */
export interface MapOption {
  id: string
  name: string
  rating?: number
  address?: string
  /** Which search found it ("kosher restaurant", "night view"…). */
  foundBy: string
}

export interface DayPlanRequest {
  /** English area name ("Kyoto"), or empty when the day has no city yet. */
  area: string
  /** e.g. "Monday, 12 October 2026" */
  dateLabel: string
  wishes: string
  relaxed: boolean
  saved: { id: string; name: string; category: CategoryId }[]
  /** Stops already in the day (saved places). */
  fixed: { id: string; time?: string; name: string }[]
  /** Saved places planned on other days, not to be suggested again. */
  elsewhere: string[]
  /** Where they sleep the night before (start of the day). */
  hotel?: string
  /** Real restaurants nearby: meals are chosen from these only. */
  restaurants: MapOption[]
  /** Real sights nearby (sights, night views…). */
  sights: MapOption[]
  /** Revising a plan: the plan as it is, and what to change. */
  current?: PlannedStop[]
  change?: string
}

const optionLine = (option: MapOption) =>
  `[${option.id}] ${option.name}${option.rating ? ` (rating ${option.rating.toFixed(1)})` : ''} (found by "${option.foundBy}")${option.address ? ` — ${option.address}` : ''}`

/**
 * Letters of scripts that don't belong in the app's Hebrew: the model sometimes slips Arabic, Thai or
 * Cyrillic letters into a Hebrew word. (Hebrew, Latin and Japanese are fine.)
 */
const FOREIGN_SCRIPT = /[Ͱ-ϿЀ-ԯ؀-ۿݐ-ݿࢠ-ࣿऀ-෿฀-໿Ⴀ-ჿ가-힯ﭐ-﷿ﹰ-﻿]/

/** The model's text, or `fallback` when it's empty or has letters of another script mixed in. */
export function cleanText(text: string | undefined | null, fallback = ''): string {
  const value = (text ?? '').trim()
  return value && !FOREIGN_SCRIPT.test(value) ? value : fallback
}

/** A full day, built around what's already fixed and the places the group saved (or a plan revised). */
export async function planDayWithAi(request: DayPlanRequest): Promise<{ reply: string; stops: PlannedStop[] }> {
  const lines = [
    `Area: ${request.area || 'not chosen yet: infer it from the wishes and the saved places'}`,
    `Date: ${request.dateLabel}`,
    `Pace: ${request.relaxed ? 'relaxed' : 'full day'}`,
    `They feel like: ${request.wishes.trim() || '(no preference: a great classic day there)'}`,
    request.hotel ? `They sleep at: ${request.hotel}` : '',
    `Fixed stops: ${request.fixed.length ? request.fixed.map((stop) => `[${stop.id}] ${stop.time ?? 'any time'} ${stop.name}`).join('; ') : 'none'}`,
    `Saved places nearby: ${request.saved.length ? request.saved.map((place) => `[${place.id}] ${place.name} (${place.category})`).join('; ') : 'none'}`,
    request.elsewhere.length ? `Already planned on other days (don't suggest): ${request.elsewhere.join('; ')}` : '',
    `Real restaurants nearby: ${request.restaurants.length ? request.restaurants.map(optionLine).join('; ') : 'none (no map results)'}`,
    `Real sights nearby: ${request.sights.length ? request.sights.map(optionLine).join('; ') : 'none (no map results)'}`,
    request.current?.length
      ? `Current plan: ${request.current
          .map(
            (stop) =>
              `${stop.time} ${stop.searchName} [${stop.savedId ? `savedId ${stop.savedId}` : stop.mapId ? `mapId ${stop.mapId}` : 'new'}]`,
          )
          .join('; ')}`
      : '',
    request.change ? `Change request: ${request.change}` : '',
  ]
  const result = await generate('plan', lines.filter(Boolean).join('\n'))
  const json = JSON.parse(result.response.text()) as {
    reply?: string
    places?: {
      name: string
      searchName: string
      city: string
      lat: number
      lng: number
      category: string
      why: string
      time: string
      savedId?: string
      mapId?: string
    }[]
  }
  const savedIds = new Set([...request.saved, ...request.fixed].map((place) => place.id))
  for (const stop of request.current ?? []) if (stop.savedId) savedIds.add(stop.savedId)
  const mapIds = new Set([...request.restaurants, ...request.sights].map((option) => option.id))
  return {
    reply: cleanText(json.reply),
    stops: (json.places ?? [])
      .filter((p) => /^\d{1,2}:\d{2}$/.test(p.time))
      .slice(0, 9)
      .map((p) => ({
        name: cleanText(p.name, p.searchName),
        searchName: p.searchName,
        city: p.city,
        category: CATEGORY_IDS.includes(p.category as CategoryId) ? (p.category as CategoryId) : 'other',
        location: { lat: p.lat, lng: p.lng },
        why: cleanText(p.why),
        time: p.time.padStart(5, '0'),
        ...(p.savedId && savedIds.has(p.savedId) ? { savedId: p.savedId } : {}),
        ...(p.mapId && mapIds.has(p.mapId) ? { mapId: p.mapId } : {}),
      }))
      .sort((a, b) => a.time.localeCompare(b.time)),
  }
}

/** An indoor alternative for one of the day's stops, at the same time. */
export interface RainSwap extends PlannedStop {
  /** The itinerary item it replaces. */
  replaceId: string
}

export interface RainPlanRequest {
  area: string
  dateLabel: string
  /** e.g. "13:00-17:00" or "most of the day (no hourly forecast yet)". */
  rain: string
  /** The day's stops, by itinerary item id. */
  stops: { id: string; time?: string; name: string; category: CategoryId }[]
  saved: { id: string; name: string; category: CategoryId }[]
  elsewhere: string[]
  hotel?: string
}

/** Indoor alternatives for the day's outdoor stops at rainy hours. */
export async function rainPlanWithAi(request: RainPlanRequest): Promise<{ reply: string; swaps: RainSwap[] }> {
  const lines = [
    `Area: ${request.area || 'infer it from the stops'}`,
    `Date: ${request.dateLabel}`,
    `Rain expected: ${request.rain}`,
    request.hotel ? `They sleep at: ${request.hotel}` : '',
    `The day's stops: ${request.stops.map((stop) => `[${stop.id}] ${stop.time ?? 'any time'} ${stop.name} (${stop.category})`).join('; ')}`,
    `Saved places nearby: ${request.saved.length ? request.saved.map((place) => `[${place.id}] ${place.name} (${place.category})`).join('; ') : 'none'}`,
    request.elsewhere.length ? `Already planned on other days (don't suggest): ${request.elsewhere.join('; ')}` : '',
  ]
  const result = await generate('rain', lines.filter(Boolean).join('\n'))
  const json = JSON.parse(result.response.text()) as {
    reply?: string
    places?: {
      name: string
      searchName: string
      city: string
      lat: number
      lng: number
      category: string
      why: string
      time: string
      savedId?: string
      replaceId: string
    }[]
  }
  const stopIds = new Set(request.stops.map((stop) => stop.id))
  const savedIds = new Set(request.saved.map((place) => place.id))
  const replaced = new Set<string>()
  return {
    reply: cleanText(json.reply),
    swaps: (json.places ?? [])
      // One alternative per stop, for stops that are really in the day.
      .filter((p) => stopIds.has(p.replaceId) && !replaced.has(p.replaceId) && replaced.add(p.replaceId))
      .map((p) => ({
        name: cleanText(p.name, p.searchName),
        searchName: p.searchName,
        city: p.city,
        category: CATEGORY_IDS.includes(p.category as CategoryId) ? (p.category as CategoryId) : 'other',
        location: { lat: p.lat, lng: p.lng },
        why: cleanText(p.why),
        time: /^\d{1,2}:\d{2}$/.test(p.time) ? p.time.padStart(5, '0') : '',
        replaceId: p.replaceId,
        ...(p.savedId && savedIds.has(p.savedId) ? { savedId: p.savedId } : {}),
      })),
  }
}

export { nameMatch } from './names'

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

  // Google: the place has to really be there under that name. The nearest "similar" result is not
  // enough: an invented restaurant would borrow a real one's position.
  if (provider.id === 'google' && provider.verify) {
    try {
      const poi = await provider.verify(place.searchName, place.location, signal, place.address ?? place.city)
      if (poi) return { ...poi, name: place.name }
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
