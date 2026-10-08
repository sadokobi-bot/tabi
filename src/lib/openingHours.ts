import type { OpeningPeriod } from '@/maps/poi'

export type OpeningStatus =
  | { kind: 'open' }
  | { kind: 'closed-day' }
  /** `hours` lists that day's windows, e.g. "11:00-22:00". */
  | { kind: 'closed-time'; hours: string }

const DAY = 24 * 60
const WEEK = 7 * DAY

const hm = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/**
 * Is a place open on `date` (YYYY-MM-DD, its local calendar) and, when given, at `time` (HH:mm)?
 * Windows past midnight count for the day they start on. Null when the hours are unknown.
 */
export function checkOpening(periods: OpeningPeriod[] | undefined, date: string, time?: string): OpeningStatus | null {
  if (!periods || periods.length === 0) return null
  if (periods.some((period) => !period.close)) return { kind: 'open' }

  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  const windows = periods.map((period) => {
    const start = period.open.day * DAY + period.open.minutes
    let end = period.close!.day * DAY + period.close!.minutes
    if (end <= start) end += WEEK
    return { start, end, startsToday: period.open.day === day }
  })
  const today = windows.filter((window) => window.startsToday).sort((a, b) => a.start - b.start)
  const covers = (minute: number) =>
    windows.some((w) => (minute >= w.start && minute < w.end) || (minute + WEEK >= w.start && minute + WEEK < w.end))

  if (!time) {
    const dayStart = day * DAY
    const openAtAll = today.length > 0 || covers(dayStart)
    return openAtAll ? { kind: 'open' } : { kind: 'closed-day' }
  }

  const [h, m] = time.split(':').map(Number)
  if (covers(day * DAY + h! * 60 + m!)) return { kind: 'open' }
  if (today.length === 0) return { kind: 'closed-day' }
  const hours = today.map((w) => `${hm(w.start % DAY)}-${hm(w.end % DAY)}`).join(', ')
  return { kind: 'closed-time', hours }
}

/** Short Hebrew warning for a closed status, or null when open or unknown. */
export function closedLabel(status: OpeningStatus | null): string | null {
  if (!status || status.kind === 'open') return null
  return status.kind === 'closed-day' ? 'סגור ביום הזה' : `סגור בשעה הזו. פתוח ${status.hours}`
}

export type ClosingStatus =
  { kind: 'closes-soon'; minutesLeft: number; at: string } | { kind: 'opens-later'; at: string } | { kind: 'closed-for-today' }

/** How far ahead "closing soon" starts warning. */
const SOON_MIN = 90

/**
 * Right now (`nowMinutes` on `date`, the place's local day): about to close, closed until later
 * today, or closed for the rest of the day. Null when open for a while yet, or the hours are unknown.
 */
export function closingStatus(periods: OpeningPeriod[] | undefined, date: string, nowMinutes: number): ClosingStatus | null {
  if (!periods || periods.length === 0 || periods.some((period) => !period.close)) return null

  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  const now = day * DAY + nowMinutes
  const windows = periods.map((period) => {
    const start = period.open.day * DAY + period.open.minutes
    let end = period.close!.day * DAY + period.close!.minutes
    if (end <= start) end += WEEK
    return { start, end }
  })

  for (const { start, end } of windows) {
    // A window that started late on Saturday may still be running early on Sunday (one week on).
    for (const at of [now, now + WEEK]) {
      if (at >= start && at < end) {
        const minutesLeft = end - at
        return minutesLeft <= SOON_MIN ? { kind: 'closes-soon', minutesLeft, at: hm(end % DAY) } : null
      }
    }
  }

  const laterToday = windows
    .map(({ start }) => start)
    .filter((start) => start > now && start < (day + 1) * DAY)
    .sort((a, b) => a - b)[0]
  return laterToday != null ? { kind: 'opens-later', at: hm(laterToday % DAY) } : { kind: 'closed-for-today' }
}

/** Hebrew line for a closing status; `urgent` when there's (almost) no point going now. */
export function closingLabel(status: ClosingStatus | null): { text: string; urgent: boolean } | null {
  if (!status) return null
  switch (status.kind) {
    case 'closes-soon':
      return status.minutesLeft <= 30
        ? { text: `נסגר בעוד ${status.minutesLeft} דק׳ (${status.at}), כנראה לא תספיקו`, urgent: true }
        : { text: `נסגר היום ב-${status.at}, בעוד ${status.minutesLeft} דק׳`, urgent: false }
    case 'opens-later':
      return { text: `סגור עכשיו, נפתח ב-${status.at}`, urgent: false }
    case 'closed-for-today':
      return { text: 'כבר סגור להיום', urgent: true }
  }
}
