import type { Booking } from '@/data/types'
import { diffDays, formatDay } from './dates'

export type BookingStatus = { kind: 'booked' } | { kind: 'open' } | { kind: 'today' } | { kind: 'soon'; days: number; opensOn: string }

/** Where a booking stands on `today` (YYYY-MM-DD in Japan). */
export function bookingStatus(booking: Booking, today: string): BookingStatus {
  if (booking.booked) return { kind: 'booked' }
  if (!booking.opensOn) return { kind: 'open' }
  const days = diffDays(today, booking.opensOn)
  if (days > 0) return { kind: 'soon', days, opensOn: booking.opensOn }
  return days === 0 ? { kind: 'today' } : { kind: 'open' }
}

export function bookingLabel(status: BookingStatus): string {
  switch (status.kind) {
    case 'booked':
      return 'הוזמן'
    case 'open':
      return 'אפשר להזמין עכשיו'
    case 'today':
      return 'ההזמנות נפתחות היום!'
    case 'soon':
      return `נפתח ${status.days === 1 ? 'מחר' : `בעוד ${status.days} ימים`} · ${formatDay(status.opensOn, { day: 'numeric', month: 'short' })}`
  }
}

/** Sort key: open now first, then by the day booking opens; booked last. */
export function bookingRank(status: BookingStatus): number {
  if (status.kind === 'booked') return Number.MAX_SAFE_INTEGER
  if (status.kind === 'soon') return status.days
  return status.kind === 'today' ? -1 : -2
}
