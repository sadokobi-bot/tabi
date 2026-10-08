import { addDays } from '@/lib/dates'
import { stayFor } from './stays'
import type { Place, Trip } from './types'

/** A hotel change: check out of `from` and into `to` on `date`. */
export interface HotelMove {
  date: string
  from: Place
  to: Place
}

/** The hotel change on `date` (the night before at one hotel, that night at another), if any. */
export function moveOn(trip: Pick<Trip, 'stays'>, placesById: Record<string, Place>, date: string): HotelMove | null {
  const fromId = stayFor(trip.stays, addDays(date, -1))
  const toId = stayFor(trip.stays, date)
  const from = fromId ? placesById[fromId] : undefined
  const to = toId ? placesById[toId] : undefined
  return from && to && from.id !== to.id ? { date, from, to } : null
}

/** How the move into this hotel goes, when the trip has one (for the hotel's own page). */
export function moveInto(trip: Pick<Trip, 'stays'>, placesById: Record<string, Place>, hotelId: string): HotelMove | null {
  for (const [date, placeId] of Object.entries(trip.stays).sort(([a], [b]) => a.localeCompare(b))) {
    if (placeId !== hotelId) continue
    const move = moveOn(trip, placesById, date)
    if (move) return move
  }
  return null
}

/** Sent from the hotel we're leaving on this move (an older shipment to the same hotel doesn't count). */
export function luggageSent(move: HotelMove): boolean {
  const luggage = move.to.luggage
  return Boolean(luggage && luggage.fromId === move.from.id && luggage.sentOn >= addDays(move.date, -3))
}
