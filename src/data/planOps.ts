import { newId } from '@/lib/ids'
import { parseHm } from '@/lib/dates'
import type { DayPlan, ItineraryItem } from './types'

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
  return { [date]: insertByTime(items.filter((item) => item.id !== itemId), updated) }
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
