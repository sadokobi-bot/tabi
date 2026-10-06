import { useMemo, useState } from 'react'
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
import { actions } from '@/data/actions'
import { getCity } from '@/data/cities'
import type { DayPlan, ItineraryItem, Place, Trip } from '@/data/types'
import { formatDay, tripDates } from '@/lib/dates'
import { newId } from '@/lib/ids'
import { DayCard } from './DayCard'
import { RowContent, SortableRow } from './SortableRow'

const IDEAS = 'ideas'
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

  // Every scheduled item by id, so drops can rebuild day arrays.
  const itemsById = useMemo(() => {
    const map = new Map<string, ItineraryItem>()
    for (const items of Object.values(plan)) for (const item of items) map.set(item.id, item)
    return map
  }, [plan])

  const derived = useMemo<Containers>(() => {
    const scheduled = new Set<string>()
    const containers: Containers = {}
    for (const date of dates) {
      const items = (plan[date] ?? []).filter((item) => placesById[item.placeId])
      items.forEach((item) => scheduled.add(item.placeId))
      containers[date] = items.map((item) => item.id)
    }
    containers[IDEAS] = places.filter((place) => !scheduled.has(place.id)).map((place) => ideaId(place.id))
    return containers
  }, [dates, plan, places, placesById])

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
          emptyLabel={places.length ? 'כל המקומות משובצים' : 'שמרו מקומות מהמפה והם יופיעו כאן'}
        >
          {(containers[IDEAS] ?? []).map((id) => {
            const place = placeFor(id)
            return place ? <SortableRow key={id} id={id} place={place} /> : null
          })}
        </DayCard>

        {dates.map((date, index) => {
          const ids = containers[date] ?? []
          const city = getCity(trip.dayCities[date])
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

      <DragOverlay>
        {activePlace ? <RowContent place={activePlace} item={activeItem} lifted /> : null}
      </DragOverlay>
    </DndContext>
  )
}
