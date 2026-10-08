import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Check, LoaderCircle, Plus, Sparkles, Star } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { actions } from '@/data/actions'
import { CATEGORIES } from '@/data/categories'
import { getCity, nearestCity, type City } from '@/data/cities'
import type { CategoryId, Place } from '@/data/types'
import { formatDay, tripDates } from '@/lib/dates'
import type { Poi, PoiProvider } from '@/maps/poi'
import { usePoiProvider } from '@/maps/usePoiProvider'
import { useTrip, useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

const KINDS: CategoryId[] = ['attraction', 'food', 'cafe', 'nature', 'shopping', 'nightlife', 'amusement']

/** What to ask Google for, per category (English queries return the best-known places). */
const QUERY: Partial<Record<CategoryId, (city: string) => string>> = {
  attraction: (city) => `top tourist attractions in ${city}, Japan`,
  food: (city) => `best restaurants in ${city}, Japan`,
  cafe: (city) => `best cafes in ${city}, Japan`,
  nature: (city) => `beautiful parks and gardens in ${city}, Japan`,
  shopping: (city) => `best shopping streets in ${city}, Japan`,
  nightlife: (city) => `best bars and izakaya in ${city}, Japan`,
  amusement: (city) => `amusement parks and arcades in ${city}, Japan`,
}

/** The free map searches a box around the city center (Overpass area limit). */
const OSM_HALF_SPAN_DEG = 0.02

/** One lookup per city and category per session (Google text search is a billed call). */
const cache = new Map<string, Poi[]>()

function recommend(provider: PoiProvider, city: City, kind: CategoryId, signal: AbortSignal): Promise<Poi[]> {
  if (provider.id === 'google') return provider.searchText(QUERY[kind]!(city.en), city.location, signal)
  const { lat, lng } = city.location
  const bounds = {
    north: lat + OSM_HALF_SPAN_DEG,
    south: lat - OSM_HALF_SPAN_DEG,
    east: lng + OSM_HALF_SPAN_DEG,
    west: lng - OSM_HALF_SPAN_DEG,
  }
  return provider.searchArea(bounds, [kind], signal).then((result) => (result.status === 'ok' ? result.pois : []))
}

type Results = { status: 'loading' } | { status: 'ok'; pois: Poi[] } | { status: 'error' }

/** Ideas for one day of the trip, from its city: saved places not yet scheduled, then map recommendations. */
export function CityIdeasSheet({ date, onClose }: { date: string | null; onClose: () => void }) {
  // Portaled: the trip's tab panel is its own stacking context, under the tab bar.
  return createPortal(
    <BottomSheet open={date !== null} onClose={onClose} label="רעיונות ליום">
      {date && <CityIdeas key={date} date={date} onClose={onClose} />}
    </BottomSheet>,
    document.body,
  )
}

function CityIdeas({ date, onClose }: { date: string; onClose: () => void }) {
  const trip = useTrip()
  const plan = useTripStore((state) => state.plan)
  const places = useTripStore((state) => state.places)
  const provider = usePoiProvider()
  const city = getCity(trip.dayCities[date])
  const [kind, setKind] = useState<CategoryId>('attraction')
  const [results, setResults] = useState<Results>({ status: 'loading' })

  const scheduled = useMemo(() => new Set(Object.values(plan).flatMap((items) => items.map((item) => item.placeId))), [plan])
  const inThisDay = useMemo(() => new Set((plan[date] ?? []).map((item) => item.placeId)), [plan, date])
  const savedIdeas = useMemo(
    () => (city ? places.filter((place) => !scheduled.has(place.id) && nearestCity(place.location)?.id === city.id) : []),
    [places, scheduled, city],
  )

  useEffect(() => {
    if (!provider || !city) return
    const key = `${provider.id}:${city.id}:${kind}`
    const hit = cache.get(key)
    if (hit) {
      setResults({ status: 'ok', pois: hit })
      return
    }
    const controller = new AbortController()
    setResults({ status: 'loading' })
    recommend(provider, city, kind, controller.signal).then(
      (pois) => {
        cache.set(key, pois)
        setResults({ status: 'ok', pois })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          console.error('[ideas] lookup failed', error)
          setResults({ status: 'error' })
        }
      },
    )
    return () => controller.abort()
  }, [provider, city, kind])

  if (!city) return null
  const dayNumber = tripDates(trip).indexOf(date) + 1

  const savedFor = (poi: Poi): Place | undefined =>
    places.find((place) => (poi.googlePlaceId && place.googlePlaceId === poi.googlePlaceId) || (poi.osmId && place.osmId === poi.osmId))

  const addPlace = (place: Place) => actions.addToDay(place.id, date, undefined, `נוסף ליום ${dayNumber}`)

  const addPoi = (poi: Poi) => {
    const existing = savedFor(poi)
    if (existing) {
      addPlace(existing)
      return
    }
    const place = actions.createPlace(
      {
        name: poi.name,
        category: poi.category,
        location: poi.location,
        ...(poi.address ? { address: poi.address } : {}),
        ...(poi.googlePlaceId ? { googlePlaceId: poi.googlePlaceId } : {}),
        ...(poi.osmId ? { osmId: poi.osmId } : {}),
      },
      null,
    )
    addPlace(place)
  }

  const open = (target: { place?: Place; poi?: Poi }) => {
    onClose()
    if (target.place) ui.openPlace(target.place.id)
    else if (target.poi) ui.openPoi(target.poi)
  }

  return (
    <div className="px-5 pb-6">
      <header className="flex items-center gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">רעיונות ב{city.name}</h2>
          <p className="text-sm text-muted">
            ליום {dayNumber} · {formatDay(date, { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
        </div>
      </header>

      {savedIdeas.length > 0 && (
        <section className="mt-5">
          <h3 className="mb-2 text-xs font-semibold text-muted">מהרשימה שלכם, עוד לא בלו״ז</h3>
          <ul className="space-y-2">
            {savedIdeas.map((place) => (
              <IdeaRow
                key={place.id}
                category={place.category}
                name={place.name}
                onOpen={() => open({ place })}
                added={false}
                onAdd={() => addPlace(place)}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5">
        <h3 className="mb-2 text-xs font-semibold text-muted">המלצות מהמפה</h3>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1" role="group" aria-label="סוג המלצה">
          {KINDS.map((id) => {
            const config = CATEGORIES[id]
            const Icon = config.icon
            return (
              <button
                key={id}
                type="button"
                aria-pressed={kind === id}
                onClick={() => setKind(id)}
                className={clsx(
                  'tap-target relative flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors',
                  kind === id ? 'bg-accent-fill text-accent-fg' : 'bg-fg/6 text-fg hover:bg-fg/10',
                )}
              >
                <Icon aria-hidden className="size-4" />
                {config.plural}
              </button>
            )
          })}
        </div>

        <div className="mt-3 min-h-40">
          {results.status === 'loading' ? (
            <div className="grid h-40 place-items-center">
              <LoaderCircle aria-label="מחפשים המלצות" className="size-6 animate-spin text-muted" />
            </div>
          ) : results.status === 'error' ? (
            <p className="py-10 text-center text-sm text-muted">לא הצלחנו לטעון המלצות. נסו שוב בעוד רגע.</p>
          ) : results.pois.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">לא מצאנו המלצות מהסוג הזה ב{city.name}</p>
          ) : (
            <ul className="space-y-2">
              {results.pois.map((poi) => {
                const saved = savedFor(poi)
                return (
                  <IdeaRow
                    key={poi.key}
                    category={poi.category}
                    name={poi.name}
                    rating={poi.rating}
                    ratingCount={poi.ratingCount}
                    onOpen={() => open(saved ? { place: saved } : { poi })}
                    added={saved ? inThisDay.has(saved.id) : false}
                    onAdd={() => addPoi(poi)}
                  />
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

interface IdeaRowProps {
  category: CategoryId
  name: string
  rating?: number
  ratingCount?: number
  added: boolean
  onOpen: () => void
  onAdd: () => void
}

function IdeaRow({ category, name, rating, ratingCount, added, onOpen, onAdd }: IdeaRowProps) {
  return (
    <li className="surface flex items-center gap-3 rounded-control p-2 ps-2.5">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-start">
        <CategoryIcon category={category} className="size-10" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{name}</span>
          {rating != null && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Star aria-hidden className="size-3.5 fill-amber-400 text-amber-400" />
              {rating.toFixed(1)}
              {ratingCount != null && <span>({ratingCount.toLocaleString('he-IL')})</span>}
            </span>
          )}
        </span>
      </button>
      {added ? (
        <span className="flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <Check aria-hidden className="size-4" /> ביום
        </span>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-accent/12 px-3 text-xs font-semibold text-accent transition active:scale-95"
        >
          <Plus aria-hidden className="size-4" /> ליום
        </button>
      )}
    </li>
  )
}
