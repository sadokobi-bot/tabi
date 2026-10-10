import { useEffect, useState } from 'react'
import type { ItineraryItem, LatLng, Place } from '@/data/types'
import { parseHm } from '@/lib/dates'
import { formatDistance } from '@/lib/geo'
import { pathMeters } from '@/lib/travel'
import { fetchDayForecast, rainWindows, type DayForecast } from '@/lib/weather'
import { useTripStore } from '@/store/trip'

/** Out in the open: these are the stops rain actually spoils. */
const OUTDOOR = new Set<Place['category']>(['nature', 'amusement'])

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`

export interface DayAlert {
  kind: 'rain' | 'ticket' | 'tickets' | 'heat' | 'cold'
  /** For the chip on the Today card. */
  short: string
  /** The whole story (the chip's accessible name). */
  text: string
}

export interface DayBrief {
  /** "7 עצירות · 3.2 ק״מ · מ-09:30", or null on an empty day. */
  summary: string | null
  /** Worth knowing today, most important first. */
  alerts: DayAlert[]
}

/**
 * The day in a line, and what's worth a warning: rain hours (and which outdoor stop they hit), a
 * ticket that must be booked and isn't, a very hot or cold day. Shown on the Today card.
 */
export function useDayBrief({
  date,
  items,
  placesById,
  location,
  start,
}: {
  date: string
  items: ItineraryItem[]
  placesById: Record<string, Place>
  /** Where the forecast is for: the day's city (or its first stop). */
  location: LatLng
  /** Where the day starts (last night's hotel). */
  start?: Place
}): DayBrief {
  const [forecast, setForecast] = useState<DayForecast | null>(null)
  const tickets = useTripStore((state) => state.tickets)
  const { lat, lng } = location

  useEffect(() => {
    const controller = new AbortController()
    fetchDayForecast({ lat, lng }, date, controller.signal).then(setForecast, () => undefined)
    return () => controller.abort()
  }, [lat, lng, date])

  const stops = items.flatMap((item) => {
    const place = placesById[item.placeId]
    return place ? [{ item, place }] : []
  })

  let summary: string | null = null
  if (stops.length > 0) {
    const points = [...(start ? [start.location] : []), ...stops.map(({ place }) => place.location)]
    const first = stops.find(({ item }) => item.time)
    summary = [
      stops.length === 1 ? 'עצירה אחת' : `${stops.length} עצירות`,
      points.length > 1 && formatDistance(pathMeters(points) * 1.3),
      first && `מ-${first.item.time}`,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  const alerts: DayAlert[] = []
  if (forecast) {
    const windows = rainWindows(forecast)
    if (windows.length > 0) {
      const ranges = windows.map(([from, to]) => `${hourLabel(from)}–${hourLabel(to)}`).join(', ')
      const wet = stops.find(({ item, place }) => {
        const minutes = parseHm(item.time)
        return OUTDOOR.has(place.category) && minutes != null && windows.some(([from, to]) => minutes >= from * 60 && minutes < to * 60)
      })
      alerts.push({
        kind: 'rain',
        short: `גשם ${hourLabel(windows[0]![0])}–${hourLabel(windows[0]![1])}`,
        text: `גשם צפוי ${ranges}, קחו מטריה${wet ? `. בדיוק אז אתם ב${wet.place.name}, בחוץ` : ''}`,
      })
    }
  }
  const unbooked = stops.find(
    ({ place }) =>
      place.entry?.bookAhead === 'required' && !place.booking?.booked && !tickets.some((ticket) => ticket.placeId === place.id),
  )
  if (unbooked) {
    alerts.push({
      kind: 'ticket',
      short: 'כרטיס שעוד לא הוזמן',
      text: `${unbooked.place.name} צריך כרטיס מראש, ועוד לא סומן שהוזמן`,
    })
  }
  // Tickets already in the app for today's stops: the chip leads to them.
  const held = stops.filter(({ place }) => tickets.some((ticket) => ticket.placeId === place.id))
  if (held.length > 0) {
    alerts.push({
      kind: 'tickets',
      short: 'לצפייה בכרטיסי הכניסה',
      text: held.length > 1 ? 'יש כרטיסי כניסה להיום' : `יש כרטיס כניסה ל${held[0]!.place.name}`,
    })
  }
  if (forecast && forecast.max >= 30) alerts.push({ kind: 'heat', short: 'חם: שתו הרבה מים', text: 'יום חם: שתו הרבה מים' })
  else if (forecast && forecast.min <= 5) alerts.push({ kind: 'cold', short: 'קר: התלבשו חם', text: 'יום קר: התלבשו חם' })

  return { summary, alerts }
}
