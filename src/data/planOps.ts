import { newId } from '@/lib/ids'
import { parseHm } from '@/lib/dates'
import { pathMeters, shortestPathOrder } from '@/lib/travel'
import type { DayPlan, ItineraryItem, LatLng } from './types'

/**
 * Pure helpers that compute *changes* to the plan: { [date]: newItems }.
 * Only touched days are written, so two people editing different days never clash.
 */

/** Inserts keeping timed items in chronological order; untimed items go last. */
export function insertByTime(items: ItineraryItem[], item: ItineraryItem): ItineraryItem[] {
  const minutes = parseHm(item.time)
  if (minutes == null) return [...items, item]
  const index = items.findIndex((other) => {
    const otherMinutes = parseHm(other.time)
    return otherMinutes == null || otherMinutes > minutes
  })
  return index === -1 ? [...items, item] : [...items.slice(0, index), item, ...items.slice(index)]
}

export function addToDay(plan: DayPlan, date: string, placeId: string, time?: string): DayPlan {
  const item: ItineraryItem = { id: newId(), placeId, ...(time ? { time } : {}) }
  return { [date]: insertByTime(plan[date] ?? [], item) }
}

export function removeFromDay(plan: DayPlan, date: string, itemId: string): DayPlan {
  return { [date]: (plan[date] ?? []).filter((item) => item.id !== itemId) }
}

export function setItemTime(plan: DayPlan, date: string, itemId: string, time: string | undefined): DayPlan {
  const items = plan[date] ?? []
  const current = items.find((item) => item.id === itemId)
  if (!current) return {}
  const updated: ItineraryItem = {
    id: current.id,
    placeId: current.placeId,
    ...(current.note ? { note: current.note } : {}),
    ...(time ? { time } : {}),
  }
  return {
    [date]: insertByTime(
      items.filter((item) => item.id !== itemId),
      updated,
    ),
  }
}

export function removePlaceEverywhere(plan: DayPlan, placeId: string): DayPlan {
  const changes: DayPlan = {}
  for (const [date, items] of Object.entries(plan)) {
    if (items.some((item) => item.placeId === placeId)) {
      changes[date] = items.filter((item) => item.placeId !== placeId)
    }
  }
  return changes
}

/** Items of a day ordered for display: by time, untimed ones keep their manual order at the end. */
export function sortedDay(items: ItineraryItem[] | undefined): ItineraryItem[] {
  if (!items) return []
  return items
    .map((item, index) => ({ item, index, minutes: parseHm(item.time) }))
    .sort((a, b) => {
      if (a.minutes != null && b.minutes != null) return a.minutes - b.minutes || a.index - b.index
      if (a.minutes != null) return -1
      if (b.minutes != null) return 1
      return a.index - b.index
    })
    .map(({ item }) => item)
}

/**
 * Reorders a day for the shortest walk between stops. Timed items are appointments: they stay in
 * time order, and the untimed ones are routed onward from the last of them (or from `start`, e.g.
 * the hotel). Returns null when there's nothing to reorder or no shorter order exists.
 */
export function optimizeDay(
  items: ItineraryItem[] | undefined,
  locationOf: (item: ItineraryItem) => LatLng | undefined,
  start?: LatLng,
): { items: ItineraryItem[]; savedMeters: number } | null {
  const day = sortedDay(items).filter((item) => locationOf(item))
  const timed = day.filter((item) => parseHm(item.time) != null)
  const untimed = day.filter((item) => parseHm(item.time) == null)
  if (untimed.length < 2) return null

  const lastTimed = timed[timed.length - 1]
  const anchor = (lastTimed && locationOf(lastTimed)) ?? start
  const order = shortestPathOrder(
    untimed.map((item) => locationOf(item)!),
    anchor,
  )
  const reordered = [...timed, ...order.map((index) => untimed[index]!)]
  // Items whose place is gone are kept (at the end) rather than silently dropped from the plan.
  const orphans = sortedDay(items).filter((item) => !locationOf(item))

  const pathOf = (list: ItineraryItem[]) =>
    pathMeters([...(start && !timed.length ? [start] : []), ...list.map((item) => locationOf(item)!)])
  const savedMeters = pathOf(day) - pathOf(reordered)
  if (savedMeters < 50 || reordered.every((item, i) => item.id === day[i]?.id)) return null
  return { items: [...reordered, ...orphans], savedMeters }
}
