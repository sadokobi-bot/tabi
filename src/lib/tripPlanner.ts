import { actions } from '@/data/actions'
import { CITIES, getCity, nearestCity } from '@/data/cities'
import { insertByTime, sortedDay } from '@/data/planOps'
import type { DayPlan, ItineraryItem, Place, Trip } from '@/data/types'
import type { Poi, PoiProvider } from '@/maps/poi'
import { useTripStore } from '@/store/trip'
import { outlineTripWithAi, planDaysWithAi, resolveOnMap, type PlannedStop } from './assistant'
import { tripDates } from './dates'
import { distanceMeters } from './geo'
import { newId } from './ids'
import { dietOf, findRestaurants, searchOptions, type MapOptions } from './mealOptions'
import { nameMatch } from './names'
import { spend } from './quota'
import { seasonFor } from './seasons'

/** The short questionnaire before planning the whole trip. */
export interface TripPreferences {
  travelers: 'couple' | 'friends' | 'family' | 'solo'
  pace: 'relaxed' | 'balanced' | 'packed'
  budget: 'budget' | 'mid' | 'luxury'
  /** City ids they want; empty: the planner chooses. */
  cities: string[]
  mustSee: string
  interests: string[]
  /** Attractions they want in the trip (ids from ATTRACTIONS). */
  attractions: string[]
  food: string[]
  notes: string
  /** Seasonal highlights in their dates they want built in (ids from seasons.ts). */
  season: string[]
}

/** A stop checked on the map (none for places already saved). */
export type CheckedStop = PlannedStop & { poi?: Poi }

export interface PlannedDay {
  date: string
  city: string
  theme: string
  stops: CheckedStop[]
}

export interface TripPlan {
  reply: string
  days: PlannedDay[]
  /** Days that couldn't be planned (the AI didn't answer): left as they were. */
  failed: string[]
}

export interface PlanProgress {
  done: number
  total: number
  label: string
}

const TRAVELERS: Record<TripPreferences['travelers'], string> = {
  couple: 'a couple',
  friends: 'a group of friends',
  family: 'a family with children',
  solo: 'one person',
}
const BUDGET: Record<TripPreferences['budget'], string> = {
  budget: 'budget (cheap eats, free sights)',
  mid: 'mid-range',
  luxury: 'generous (fine dining, premium experiences)',
}
/** Days planned in one request. */
const CHUNK = 4
const LOCATE_TIMEOUT_MS = 10_000

/** The time of year, for the planner: what's on during the trip (chosen highlights) and what to keep in mind. */
function seasonText(trip: Trip, prefs: TripPreferences): string {
  return seasonFor(trip.startDate, trip.days)
    .filter((event) => event.kind === 'heads-up' || prefs.season.includes(event.id))
    .map((event) => `${event.kind === 'highlight' ? 'Build in' : 'Keep in mind'}: ${event.en} (usually ${event.from} to ${event.to})`)
    .join('; ')
}

/** Attractions to tick in the questionnaire: what the AI is told, and what the map is searched for. */
export const ATTRACTIONS = [
  {
    id: 'theme-parks',
    label: 'פארקי שעשועים (דיסני, יוניברסל)',
    en: 'theme parks: Tokyo Disneyland or DisneySea, Universal Studios Japan with Super Nintendo World, Fuji-Q Highland',
    search: 'theme park',
  },
  { id: 'teamlab', label: 'teamLab ואמנות דיגיטלית', en: 'teamLab digital art museums (Planets, Borderless)', search: 'teamLab' },
  {
    id: 'aquariums',
    label: 'אקווריומים וגני חיות',
    en: 'aquariums and zoos (Osaka Kaiyukan, Sumida Aquarium, Ueno Zoo)',
    search: 'aquarium zoo',
  },
  {
    id: 'views',
    label: 'תצפיות וגורדי שחקים',
    en: 'observation decks at sunset (Shibuya Sky, Tokyo Skytree, Umeda Sky Building)',
    search: 'observation deck',
  },
  {
    id: 'characters',
    label: 'ג׳יבלי, פוקימון ונינטנדו',
    en: 'Ghibli Museum or Ghibli Park (tickets sell out a month ahead), Pokémon Center, Nintendo stores',
    search: 'Pokemon Center Nintendo store',
  },
  {
    id: 'experiences',
    label: 'חוויות יפניות (קימונו, טקס תה, סומו)',
    en: 'Japanese experiences: kimono rental, a tea ceremony, sumo (a tournament or a morning practice)',
    search: 'tea ceremony kimono experience',
  },
  { id: 'arcades', label: 'ארקיידים וקרטינג', en: 'game arcades and street go-karting', search: 'game center arcade' },
] as const

const attractionsOf = (prefs: TripPreferences) => ATTRACTIONS.filter((a) => prefs.attractions.includes(a.id))

/** Interests and attractions, as the AI gets them. */
const interestsOf = (prefs: TripPreferences) =>
  [...prefs.interests, ...attractionsOf(prefs).map((a) => `attractions they want: ${a.en}`)].join(', ')

const wishesOf = (prefs: TripPreferences) => [interestsOf(prefs), prefs.food.join(', '), prefs.notes].filter(Boolean).join('. ')

/** Sights of a whole city, more for a longer stay, shaped by their interests. */
async function citySights(provider: PoiProvider, near: Poi['location'], prefs: TripPreferences, days: number) {
  const interests = prefs.interests.join(' ')
  const queries = [
    'top tourist attractions',
    'night view observation deck',
    ...(days >= 3 ? ['famous temples and shrines', 'best neighborhoods to explore'] : []),
    ...(days >= 5 ? ['museums', 'markets and shopping streets'] : []),
    ...(/חיי לילה|בר/.test(interests) ? ['izakaya alley nightlife'] : []),
    ...(/קניות/.test(interests) ? ['shopping street'] : []),
    ...(/מוזיאונ|אמנות/.test(interests) ? ['art museum'] : []),
    ...(/טבע|נוף/.test(interests) ? ['garden park scenic'] : []),
    ...(/אנימה|גיימינג/.test(interests) ? ['anime shops arcade'] : []),
    ...(prefs.travelers === 'family' ? ['family attractions for kids'] : []),
    ...attractionsOf(prefs).map((a) => a.search),
  ]
  return searchOptions(provider, near, [...new Set(queries)], 's', Math.min(60, 25 + days * 5))
}

/** Every new place has to be on the map; saved places and places from the map lists are exact already. */
async function check(stops: PlannedStop[], lists: { restaurants: MapOptions; sights: MapOptions }, provider: PoiProvider | null) {
  const { places } = useTripStore.getState()
  const checked = await Promise.all(
    stops.map(async (stop): Promise<CheckedStop | null> => {
      if (stop.savedId) return stop
      const saved = places.find(
        (place) =>
          (nameMatch(stop.name, place.name) >= 0.5 || nameMatch(stop.searchName, place.name) >= 0.5) &&
          distanceMeters(stop.location, place.location) <= 1500,
      )
      if (saved) return { ...stop, savedId: saved.id }
      const restaurant = stop.mapId ? lists.restaurants.pois[stop.mapId] : undefined
      if (restaurant) return { ...stop, name: restaurant.name, poi: restaurant }
      const sight = stop.mapId ? lists.sights.pois[stop.mapId] : undefined
      if (sight) return { ...stop, poi: sight }
      try {
        const controller = new AbortController()
        const poi = await Promise.race([
          resolveOnMap(stop, provider, controller.signal),
          new Promise<null>((resolve) => setTimeout(() => (controller.abort(), resolve(null)), LOCATE_TIMEOUT_MS)),
        ])
        return poi && !poi.key.startsWith('ai:') ? { ...stop, poi } : null
      } catch {
        return null
      }
    }),
  )
  // Never the same place twice in a day.
  const seen = new Set<string>()
  return checked.filter((stop): stop is CheckedStop => {
    if (!stop) return false
    const key = stop.savedId ?? stop.poi?.key ?? stop.searchName
    return !seen.has(key) && Boolean(seen.add(key))
  })
}

/**
 * Plans the whole trip: the route first (a city for every day), then the days of each city, a few
 * at a time, from real places on the map. Days already filled keep their stops (planned around).
 */
export async function planTrip(
  trip: Trip,
  prefs: TripPreferences,
  provider: PoiProvider | null,
  onProgress: (p: PlanProgress) => void,
): Promise<TripPlan> {
  await spend('trip')
  const dates = tripDates(trip)
  const { plan, places, placesById } = useTripStore.getState()
  const wishes = wishesOf(prefs)

  // 1. The route.
  onProgress({ done: 0, total: 1, label: 'מתכננים את המסלול בין הערים…' })
  const fixedCities = dates.flatMap((date, index) => (trip.dayCities[date] ? [{ day: index + 1, city: trip.dayCities[date]! }] : []))
  const outline = await outlineTripWithAi({
    days: dates.length,
    startLabel: `starting ${new Date(`${trip.startDate}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
    travelers: TRAVELERS[prefs.travelers],
    pace: prefs.pace,
    budget: BUDGET[prefs.budget],
    interests: interestsOf(prefs),
    cities: CITIES.map(({ id, en }) => ({ id, en })),
    wanted: prefs.cities.map((id) => getCity(id)?.en ?? id),
    mustSee: prefs.mustSee,
    season: seasonText(trip, prefs),
    fixed: fixedCities,
    flights: trip.flights.map((flight) => `${flight.label}: ${flight.from} → ${flight.to}, ${flight.departAt}`).join('; '),
  })

  // 2. Runs of days in the same city, cut into requests of a few days.
  const chunks: { city: string; dates: string[] }[] = []
  dates.forEach((date, index) => {
    const city = outline.days[index]!.city
    const last = chunks.at(-1)
    if (last && last.city === city && last.dates.length < CHUNK && outline.days[index - 1]?.city === city) last.dates.push(date)
    else chunks.push({ city, dates: [date] })
  })
  const daysIn = (city: string) => outline.days.filter((day) => day.city === city).length

  const total = chunks.length + 1
  let done = 1
  const lists = new Map<string, Promise<{ restaurants: MapOptions; sights: MapOptions }>>()
  const listsFor = (city: string) => {
    let pending = lists.get(city)
    if (!pending) {
      const center = getCity(city)!.location
      pending = provider
        ? Promise.all([findRestaurants(provider, center, wishes), citySights(provider, center, prefs, daysIn(city))]).then(
            ([restaurants, sights]) => ({ restaurants, sights }),
          )
        : Promise.resolve({ restaurants: { options: [], pois: {} }, sights: { options: [], pois: {} } })
      lists.set(city, pending)
    }
    return pending
  }

  const result: Record<string, CheckedStop[]> = {}
  const failed: string[] = []
  const plannedNames: Record<string, string[]> = {}

  const runCity = async (city: string) => {
    for (const chunk of chunks.filter((c) => c.city === city)) {
      const name = getCity(city)?.name ?? city
      const first = dates.indexOf(chunk.dates[0]!) + 1
      const last = dates.indexOf(chunk.dates.at(-1)!) + 1
      onProgress({ done, total, label: `מתכננים את ${name} (${first === last ? `יום ${first}` : `ימים ${first}–${last}`})…` })
      try {
        const cityLists = await listsFor(city)
        const byDate = await planDaysWithAi({
          city: getCity(city)?.en ?? city,
          days: chunk.dates.map((date) => {
            const index = dates.indexOf(date)
            const previous = outline.days[index - 1]?.city
            const following = outline.days[index + 1]?.city
            // One day somewhere between days elsewhere is a day trip (no luggage, a full day); a new base is a move.
            const dayTrip = previous && previous !== city && following !== city
            const note =
              index === 0
                ? 'arrival day'
                : index === dates.length - 1
                  ? 'departure day'
                  : dayTrip
                    ? `day trip from ${getCity(previous)?.en} (leave in the morning, a full day)`
                    : previous && previous !== city
                      ? `travel day (from ${getCity(previous)?.en})`
                      : ''
            return {
              date,
              label: new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }),
              theme: outline.days[index]!.theme,
              note,
              fixed: sortedDay(plan[date]).flatMap((item) => {
                const place = placesById[item.placeId]
                return place ? [{ id: place.id, ...(item.time ? { time: item.time } : {}), name: place.name }] : []
              }),
            }
          }),
          travelers: TRAVELERS[prefs.travelers],
          pace: prefs.pace,
          budget: BUDGET[prefs.budget],
          wishes,
          mustSee: prefs.mustSee,
          season: seasonText(trip, prefs),
          saved: places
            .filter((place) => place.category !== 'hotel' && nearestCity(place.location)?.id === city)
            .slice(0, 50)
            .map(({ id, name, category }) => ({ id, name, category })),
          elsewhere: plannedNames[city] ?? [],
          restaurants: cityLists.restaurants.options,
          sights: cityLists.sights.options,
        })
        for (const date of chunk.dates) {
          result[date] = await check(byDate[date] ?? [], cityLists, provider)
          plannedNames[city] = [...(plannedNames[city] ?? []), ...result[date]!.map((stop) => stop.searchName)]
          if (result[date]!.length === 0) failed.push(date)
        }
      } catch (error) {
        console.warn('[trip planner] days failed', chunk.dates, error)
        failed.push(...chunk.dates)
      }
      done++
    }
  }

  // Cities in parallel (two at a time: gentle on the free AI quota); each city's days in order.
  const cities = [...new Set(chunks.map((chunk) => chunk.city))]
  const queue = [...cities]
  await Promise.all(
    [0, 1].map(async () => {
      while (queue.length) await runCity(queue.shift()!)
    }),
  )
  onProgress({ done: total, total, label: 'מסיימים…' })

  return {
    reply: outline.reply,
    days: dates.map((date, index) => ({
      date,
      city: outline.days[index]!.city,
      theme: outline.days[index]!.theme,
      stops: result[date] ?? [],
    })),
    failed,
  }
}

/** Is there a kosher restaurant in the plan (by its name)? Only asked when they wanted kosher. */
export function kosherStatus(plan: TripPlan, prefs: TripPreferences): 'found' | 'none' | null {
  if (dietOf(prefs.food.join(' ')) !== 'kosher') return null
  const found = plan.days.some((day) => day.stops.some((stop) => /kosher|chabad|כשר/i.test(`${stop.poi?.name ?? ''} ${stop.name}`)))
  return found ? 'found' : 'none'
}

/** Saves the plan: each day's city, the new places (each once), and the stops (kept beside existing ones). */
export function saveTripPlan(trip: Trip, plan: TripPlan): number {
  const state = useTripStore.getState()
  const known = new Map<string, string>()
  for (const place of state.places) {
    if (place.googlePlaceId) known.set(`g:${place.googlePlaceId}`, place.id)
    if (place.osmId) known.set(`osm:${place.osmId}`, place.id)
  }
  const placeIdFor = (stop: CheckedStop): string => {
    if (stop.savedId) return stop.savedId
    const poi = stop.poi!
    const key = poi.googlePlaceId ? `g:${poi.googlePlaceId}` : poi.osmId ? `osm:${poi.osmId}` : poi.key
    const existing = known.get(key)
    if (existing) return existing
    const created: Place = actions.createPlace(
      {
        name: stop.name,
        category: poi.category !== 'other' ? poi.category : stop.category,
        location: poi.location,
        ...(poi.googlePlaceId ? { googlePlaceId: poi.googlePlaceId } : {}),
        ...(poi.osmId ? { osmId: poi.osmId } : {}),
        ...(poi.address ? { address: poi.address } : {}),
        ...(stop.why ? { notes: stop.why } : {}),
      },
      null,
    )
    known.set(key, created.id)
    return created.id
  }

  const changes: DayPlan = {}
  let added = 0
  for (const day of plan.days) {
    if (trip.dayCities[day.date] !== day.city) actions.setDayCity(day.date, day.city)
    if (day.stops.length === 0) continue
    let items: ItineraryItem[] = [...(state.plan[day.date] ?? [])]
    const inDay = new Set(items.map((item) => item.placeId))
    for (const stop of day.stops) {
      const placeId = placeIdFor(stop)
      if (inDay.has(placeId)) continue
      inDay.add(placeId)
      items = insertByTime(items, { id: newId(), placeId, time: stop.time })
      added++
    }
    changes[day.date] = items
  }
  actions.applyPlanChanges(changes)
  return added
}
