import type { Trip } from '@/data/types'

/** All itinerary dates and times are Japan wall-clock time. */
export const TRIP_TZ = 'Asia/Tokyo'

const isoFormatterCache = new Map<string, Intl.DateTimeFormat>()

function isoFormatter(timeZone: string) {
  let formatter = isoFormatterCache.get(timeZone)
  if (!formatter) {
    // en-CA formats dates as YYYY-MM-DD.
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    isoFormatterCache.set(timeZone, formatter)
  }
  return formatter
}

/** Calendar date (YYYY-MM-DD) of `date` as seen in `timeZone`. */
export function isoDateInTz(date: Date, timeZone = TRIP_TZ): string {
  return isoFormatter(timeZone).format(date)
}

/** Minutes since midnight of `date` as seen in `timeZone`. */
export function minutesInTz(date: Date, timeZone = TRIP_TZ): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return hour * 60 + minute
}

/** Date arithmetic on ISO calendar dates (timezone-free). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y!, m! - 1, d! + days))
  return date.toISOString().slice(0, 10)
}

export function diffDays(fromIso: string, toIso: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y!, m! - 1, d!)
  }
  return Math.round((toUtc(toIso) - toUtc(fromIso)) / 86_400_000)
}

export function tripDates(trip: Pick<Trip, 'startDate' | 'days'>): string[] {
  return Array.from({ length: trip.days }, (_, i) => addDays(trip.startDate, i))
}

export type TripPhase = 'before' | 'during' | 'after'

export interface TripTimeline {
  phase: TripPhase
  /** The date the Today screen should show: today during the trip, day 1 before it, the last day after. */
  focusDate: string
  /** 1-based day number of `focusDate`. */
  dayNumber: number
  /** Whole days until the trip starts (0 during/after). */
  daysUntil: number
  today: string
}

export function tripTimeline(trip: Pick<Trip, 'startDate' | 'days'>, now: Date): TripTimeline {
  const today = isoDateInTz(now)
  const offset = diffDays(trip.startDate, today)
  if (offset < 0) return { phase: 'before', focusDate: trip.startDate, dayNumber: 1, daysUntil: -offset, today }
  if (offset >= trip.days) {
    return { phase: 'after', focusDate: addDays(trip.startDate, trip.days - 1), dayNumber: trip.days, daysUntil: 0, today }
  }
  return { phase: 'during', focusDate: today, dayNumber: offset + 1, daysUntil: 0, today }
}

/** "HH:mm" → minutes since midnight. */
export function parseHm(value: string | undefined): number | null {
  if (!value) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/** Hebrew label for an ISO date, e.g. "יום ה׳, 8 באוק׳". Formatted at UTC noon so no timezone can shift the day. */
export function formatDay(iso: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat('he-IL', { ...options, timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`))
}

/** Offset (ms) of `timeZone` from UTC at instant `date`. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - date.getTime()
}

/** Wall-clock date + time in `timeZone` → UTC instant (handles DST transitions). */
export function zonedTimeToUtc(isoDate: string, hm: string, timeZone: string): Date {
  const [y, mo, d] = isoDate.split('-').map(Number)
  const [h, mi] = hm.split(':').map(Number)
  const guess = Date.UTC(y!, mo! - 1, d!, h!, mi!)
  const first = guess - tzOffsetMs(new Date(guess), timeZone)
  const second = guess - tzOffsetMs(new Date(first), timeZone)
  return new Date(second)
}

/** Splits a UTC instant into wall-clock date/time strings in `timeZone` (for form inputs). */
export function utcToZonedParts(iso: string, timeZone: string): { date: string; time: string } {
  const date = new Date(iso)
  const minutes = minutesInTz(date, timeZone)
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return { date: isoDateInTz(date, timeZone), time: `${hh}:${mm}` }
}

/** Greeting by local hour of the device. */
export function greetingFor(date: Date): string {
  const hour = date.getHours()
  if (hour < 5) return 'לילה טוב'
  if (hour < 12) return 'בוקר טוב'
  if (hour < 17) return 'צהריים טובים'
  if (hour < 21) return 'ערב טוב'
  return 'לילה טוב'
}
