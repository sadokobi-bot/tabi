import { useMemo } from 'react'
import { BedDouble, Route, Shuffle, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { actions } from '@/data/actions'
import { optimizeDay, sortedDay } from '@/data/planOps'
import { stayFor } from '@/data/stays'
import type { ItineraryItem, LatLng, Place } from '@/data/types'
import { addDays, formatDay, tripDates } from '@/lib/dates'
import { formatDistance } from '@/lib/geo'
import { pathMeters } from '@/lib/travel'
import { useTrip, useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'
import type { MapMarker } from './types'

export interface DayRoute {
  date: string
  dayNumber: number
  stops: { item: ItineraryItem; place: Place }[]
  /** Where the day starts: the hotel of the night before, when one is set. */
  start: Place | undefined
  path: LatLng[]
  markers: MapMarker[]
}

/** A day's stops in visiting order, with the line and numbered pins to draw them. */
export function useDayRoute(date: string | null): DayRoute | null {
  const trip = useTrip()
  const plan = useTripStore((state) => state.plan)
  const placesById = useTripStore((state) => state.placesById)

  return useMemo(() => {
    if (!date) return null
    const stops = sortedDay(plan[date]).flatMap((item) => {
      const place = placesById[item.placeId]
      return place ? [{ item, place }] : []
    })
    const startId = stayFor(trip.stays, addDays(date, -1))
    const start = startId && stops[0]?.place.id !== startId ? placesById[startId] : undefined

    const markers: MapMarker[] = stops.map(({ item, place }, index) => ({
      id: `stop:${place.id}:${item.id}`,
      kind: 'saved',
      name: place.name,
      category: place.category,
      location: place.location,
      selected: false,
      order: index + 1,
    }))
    if (start) {
      markers.unshift({
        id: `place:${start.id}`,
        kind: 'saved',
        name: start.name,
        category: start.category,
        location: start.location,
        selected: false,
      })
    }

    return {
      date,
      dayNumber: tripDates(trip).indexOf(date) + 1,
      stops,
      start,
      path: [...(start ? [start.location] : []), ...stops.map(({ place }) => place.location)],
      markers,
    }
  }, [date, plan, placesById, trip])
}

/** Floating card over the map while a day route is shown: what it is, and "sort my day". */
export function DayRouteBar({ route }: { route: DayRoute }) {
  const plan = useTripStore((state) => state.plan)
  const placesById = useTripStore((state) => state.placesById)
  const untimed = route.stops.filter(({ item }) => !item.time).length

  const optimize = () => {
    const result = optimizeDay(plan[route.date], (item) => placesById[item.placeId]?.location, route.start?.location)
    if (!result) {
      ui.toast('הסדר הנוכחי כבר הכי קצר')
      return
    }
    actions.applyPlanChanges({ [route.date]: result.items })
    ui.toast(`סידרנו את היום: ${formatDistance(result.savedMeters)} פחות בדרך`)
  }

  const summary =
    route.stops.length === 0
      ? 'אין עדיין מקומות ביום הזה'
      : `${route.stops.length === 1 ? 'עצירה אחת' : `${route.stops.length} עצירות`}${
          route.path.length > 1 ? ` · ≈ ${formatDistance(pathMeters(route.path))} בקו ישר` : ''
        }`

  return (
    <div className="glass mx-4 rounded-card p-3">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
          <Route className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            מסלול יום {route.dayNumber} · {formatDay(route.date, { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          <p className="truncate text-xs text-muted">{summary}</p>
        </div>
        <button
          type="button"
          aria-label="סגירת המסלול"
          onClick={ui.clearRoute}
          className="tap-target relative grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-fg/8 hover:text-fg"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>
      {route.start && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <BedDouble aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">יוצאים מ{route.start.name}</span>
        </p>
      )}
      {untimed >= 2 && (
        <Button variant="secondary" className="mt-2.5 w-full" icon={<Shuffle aria-hidden className="size-4" />} onClick={optimize}>
          סדר לי את היום לפי הדרך הקצרה
        </Button>
      )}
    </div>
  )
}
