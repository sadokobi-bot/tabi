import { Fragment, useMemo, useState } from 'react'
import clsx from 'clsx'
import { Lightbulb, MapPin, Sparkles } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useNavigate } from 'react-router'
import { actions } from '@/data/actions'
import { CITIES, getCity, nearestCity } from '@/data/cities'
import type { DayPlan, ItineraryItem, Place, Trip } from '@/data/types'
import { formatDay, tripDates } from '@/lib/dates'
import { newId } from '@/lib/ids'
import { stayFor } from '@/data/stays'
import { ui } from '@/store/ui'
import { hasFirebase } from '@/config/env'
import { CityIdeasSheet } from './CityIdeasSheet'
import { PlanDaySheet } from './PlanDaySheet'
import { DayCard } from './DayCard'
import { StayPicker } from './StayPicker'
import { RowContent, SortableRow } from './SortableRow'

const IDEAS = 'ideas'
const ALL = 'all'
const OTHER = 'other'
const cityName = (cityId: string) => getCity(cityId)?.name ?? 'מחוץ לערים'
const FOOTER_BUTTON =
  'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-control bg-accent/[0.06] py-2 text-xs font-semibold text-accent transition hover:bg-accent/10 active:scale-[0.98]'
const ideaId = (placeId: string) => `idea:${placeId}`
const isIdea = (id: string) => id.startsWith('idea:')

type Containers = Record<string, string[]>

interface TripBoardProps {
  trip: Trip
  plan: DayPlan
  places: Place[]
  placesById: Record<string, Place>
  today: string
}

/**
 * 30-day overview with drag & drop: reorder within a day, move between days,
 * or drag unscheduled "ideas" into a day (and back out). Only changed days are written.
 */
export function TripBoard({ trip, plan, places, placesById, today }: TripBoardProps) {
  const dates = useMemo(() => tripDates(trip), [trip])
  const navigate = useNavigate()

  // Every scheduled item by id, so drops can rebuild day arrays.
  const itemsById = useMemo(() => {
    const map = new Map<string, ItineraryItem>()
    for (const items of Object.values(plan)) for (const item of items) map.set(item.id, item)
    return map
  }, [plan])

  // Which city each saved place is in, and the order cities come up in the trip (unvisited ones after).
  const cityOf = useMemo(() => new Map(places.map((place) => [place.id, nearestCity(place.location)?.id ?? OTHER])), [places])
  const cityRank = useMemo(() => {
    const order = [...new Set(dates.map((date) => trip.dayCities[date]).filter(Boolean)), ...CITIES.map((city) => city.id), OTHER]
    return (cityId: string) => order.indexOf(cityId)
  }, [dates, trip.dayCities])
  const [chosenCity, setIdeasCity] = useState(ALL)
  const [ideasFor, setIdeasFor] = useState<string | null>(null)
  const [planFor, setPlanFor] = useState<string | null>(null)

  // Unscheduled places, grouped by city in trip order, so a long list reads "Tokyo / Kyoto / …".
  const unscheduled = useMemo(() => {
    const scheduled = new Set(dates.flatMap((date) => (plan[date] ?? []).map((item) => item.placeId)))
    return places.filter((place) => !scheduled.has(place.id)).sort((a, b) => cityRank(cityOf.get(a.id)!) - cityRank(cityOf.get(b.id)!))
  }, [dates, plan, places, cityOf, cityRank])

  const ideaGroups = useMemo(() => {
    const counts = new Map<string, number>()
    for (const place of unscheduled) counts.set(cityOf.get(place.id)!, (counts.get(cityOf.get(place.id)!) ?? 0) + 1)
    return [...counts].map(([id, count]) => ({ id, count }))
  }, [unscheduled, cityOf])

  // A filter whose city has no ideas left (all scheduled) falls back to everything.
  const ideasCity = ideaGroups.some((group) => group.id === chosenCity) ? chosenCity : ALL

  const derived = useMemo<Containers>(() => {
    const containers: Containers = {}
    for (const date of dates) {
      containers[date] = (plan[date] ?? []).filter((item) => placesById[item.placeId]).map((item) => item.id)
    }
    containers[IDEAS] = unscheduled
      .filter((place) => ideasCity === ALL || cityOf.get(place.id) === ideasCity)
      .map((place) => ideaId(place.id))
    return containers
  }, [dates, plan, placesById, unscheduled, ideasCity, cityOf])

  const [dragging, setDragging] = useState<{ activeId: string; containers: Containers } | null>(null)
  const containers = dragging?.containers ?? derived

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const findContainer = (id: string, source: Containers = containers) =>
    id in source ? id : Object.keys(source).find((key) => source[key]?.includes(id))

  const placeFor = (id: string): Place | undefined =>
    isIdea(id) ? placesById[id.slice('idea:'.length)] : placesById[itemsById.get(id)?.placeId ?? '']

  const onDragStart = ({ active }: DragStartEvent) => {
    setDragging({ activeId: String(active.id), containers: derived })
  }

  // Moving across lists happens live while hovering, so the target list opens a gap.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    setDragging((current) => {
      if (!current) return current
      const from = findContainer(activeId, current.containers)
      const to = findContainer(overId, current.containers)
      if (!from || !to || from === to) return current
      const fromItems = current.containers[from] ?? []
      const toItems = current.containers[to] ?? []
      const overIndex = toItems.indexOf(overId)
      const index = overIndex >= 0 ? overIndex : toItems.length
      return {
        ...current,
        containers: {
          ...current.containers,
          [from]: fromItems.filter((id) => id !== activeId),
          [to]: [...toItems.slice(0, index), activeId, ...toItems.slice(index)],
        },
      }
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!dragging) return
    let final = dragging.containers
    const activeId = String(active.id)
    if (over) {
      const container = findContainer(activeId, final)
      const overContainer = findContainer(String(over.id), final)
      if (container && container === overContainer) {
        const items = final[container] ?? []
        const from = items.indexOf(activeId)
        const to = items.indexOf(String(over.id))
        if (from !== -1 && to !== -1 && from !== to) final = { ...final, [container]: arrayMove(items, from, to) }
      }
    }
    setDragging(null)
    commit(final)
  }

  /** Turns list ids back into itinerary items and writes only the days that changed. */
  const commit = (final: Containers) => {
    const changes: DayPlan = {}
    for (const date of dates) {
      const before = derived[date] ?? []
      const after = final[date] ?? []
      if (before.length === after.length && before.every((id, i) => id === after[i])) continue
      changes[date] = after.flatMap((id): ItineraryItem[] => {
        if (isIdea(id)) return [{ id: newId(), placeId: id.slice('idea:'.length) }]
        const item = itemsById.get(id)
        return item ? [item] : []
      })
    }
    actions.applyPlanChanges(changes)
  }

  const activePlace = dragging ? placeFor(dragging.activeId) : undefined
  const activeItem = dragging && !isIdea(dragging.activeId) ? itemsById.get(dragging.activeId) : undefined

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="space-y-6">
        <DayCard
          id={IDEAS}
          title="רעיונות שעוד לא שובצו"
          subtitle="גררו מקום ליום כדי לשבץ אותו"
          itemIds={containers[IDEAS] ?? []}
          extra={
            ideaGroups.length > 1 && (
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5" role="group" aria-label="סינון לפי עיר">
                {[{ id: ALL, count: ideaGroups.reduce((sum, group) => sum + group.count, 0) }, ...ideaGroups].map(({ id, count }) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={ideasCity === id}
                    onClick={() => setIdeasCity(id)}
                    className={clsx(
                      'tap-target relative flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold whitespace-nowrap transition-colors',
                      ideasCity === id ? 'bg-accent-fill text-accent-fg' : 'bg-fg/6 text-fg hover:bg-fg/10',
                    )}
                  >
                    {id === ALL ? 'הכל' : cityName(id)}
                    <span className={clsx('tabular-nums', ideasCity === id ? 'text-accent-fg/80' : 'text-muted')}>{count}</span>
                  </button>
                ))}
              </div>
            )
          }
          emptyLabel={
            ideasCity !== ALL
              ? `אין רעיונות ב${cityName(ideasCity)}`
              : places.length
                ? 'כל המקומות משובצים'
                : 'שמרו מקומות מהמפה והם יופיעו כאן'
          }
        >
          {(containers[IDEAS] ?? []).map((id, index, ids) => {
            const place = placeFor(id)
            if (!place) return null
            const city = cityOf.get(place.id) ?? OTHER
            const startsGroup =
              ideasCity === ALL && ideaGroups.length > 1 && (index === 0 || cityOf.get(ids[index - 1]!.slice('idea:'.length)) !== city)
            return (
              <Fragment key={id}>
                {startsGroup && (
                  <li role="presentation" className="flex items-center gap-1.5 px-1 pt-2 text-xs font-semibold text-muted first:pt-0">
                    <MapPin aria-hidden className="size-3.5" />
                    {cityName(city)}
                  </li>
                )}
                <SortableRow id={id} place={place} />
              </Fragment>
            )
          })}
        </DayCard>

        {dates.map((date, index) => {
          const ids = containers[date] ?? []
          const city = getCity(trip.dayCities[date])
          const inheritedId = index > 0 ? stayFor(trip.stays, dates[index - 1]!) : null
          return (
            <DayCard
              key={date}
              id={date}
              title={`יום ${index + 1}`}
              subtitle={formatDay(date, { weekday: 'long', day: 'numeric', month: 'long' })}
              itemIds={ids}
              isToday={date === today}
              cityId={city?.id}
              onCityChange={(cityId) => actions.setDayCity(date, cityId)}
              onShowRoute={
                ids.length > 1
                  ? () => {
                      ui.showRoute(date)
                      navigate('/map')
                    }
                  : undefined
              }
              extra={
                <StayPicker
                  date={date}
                  explicit={trip.stays[date]}
                  inherited={inheritedId ? placesById[inheritedId] : undefined}
                  places={places}
                />
              }
              footer={
                (hasFirebase || city) && (
                  <div className="mt-2 flex gap-2">
                    {/* The planner runs on Gemini through Firebase, so it needs cloud mode. */}
                    {hasFirebase && (
                      <button type="button" onClick={() => setPlanFor(date)} className={FOOTER_BUTTON}>
                        <Sparkles aria-hidden className="size-4" />
                        תכנן לי את היום
                      </button>
                    )}
                    {city && (
                      <button type="button" onClick={() => setIdeasFor(date)} className={FOOTER_BUTTON}>
                        <Lightbulb aria-hidden className="size-4" />
                        רעיונות ב{city.name}
                      </button>
                    )}
                  </div>
                )
              }
              emptyLabel="יום פנוי. גררו לכאן מקומות"
            >
              {ids.map((id) => {
                const place = placeFor(id)
                const item = isIdea(id) ? undefined : itemsById.get(id)
                return place ? <SortableRow key={id} id={id} place={place} date={item ? date : undefined} item={item} /> : null
              })}
            </DayCard>
          )
        })}
      </div>

      <CityIdeasSheet date={ideasFor} onClose={() => setIdeasFor(null)} />
      <PlanDaySheet date={planFor} onClose={() => setPlanFor(null)} />

      <DragOverlay>{activePlace ? <RowContent place={activePlace} item={activeItem} lifted /> : null}</DragOverlay>
    </DndContext>
  )
}
