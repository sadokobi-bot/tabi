import { useEffect, useState, type ReactNode } from 'react'
import { Route, Sunrise, Sunset, Thermometer, Ticket, Umbrella } from 'lucide-react'
import type { ItineraryItem, LatLng, Place } from '@/data/types'
import { parseHm } from '@/lib/dates'
import { formatDistance } from '@/lib/geo'
import { estimateLeg, pathMeters } from '@/lib/travel'
import { fetchDayForecast, rainWindows, type DayForecast } from '@/lib/weather'
import { durationLabel } from './TravelLeg'
import { readCachedRate } from '@/lib/currency'
import { useTripStore } from '@/store/trip'

/** Out in the open: these are the stops rain actually spoils. */
const OUTDOOR = new Set<Place['category']>(['nature', 'amusement'])

/** A left-to-right mark keeps the degree sign after the number inside Hebrew text. */
const degrees = (value: number) => `${Math.round(value)}°‎`

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`

interface BriefingCardProps {
  date: string
  items: ItineraryItem[]
  placesById: Record<string, Place>
  /** Where the forecast is for: the day's city (or its first stop). */
  location: LatLng
  /** Where the day starts (last night's hotel). */
  start?: Place
  /** Opens the rainy-day plan (shown when rain is expected and the day has stops). */
  onRainPlan?: () => void
}

/**
 * Morning briefing: the day in a few lines. How many stops and how far, rain hours (and which
 * outdoor stop they hit), the temperature range and sunset. Only what's worth knowing.
 */
export function BriefingCard({ date, items, placesById, location, start, onRainPlan }: BriefingCardProps) {
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
  if (stops.length === 0 && !forecast) return null

  const lines: { icon: ReactNode; text: string; tone?: 'warn' }[] = []
  let rainy = false

  if (stops.length > 0) {
    const points = [...(start ? [start.location] : []), ...stops.map(({ place }) => place.location)]
    let travel = 0
    for (let i = 1; i < points.length; i++) travel += estimateLeg(points[i - 1]!, points[i]!).minutes
    const first = stops.find(({ item }) => item.time)
    lines.push({
      icon: <Route className="size-4" />,
      text: [
        stops.length === 1 ? 'עצירה אחת' : `${stops.length} עצירות`,
        points.length > 1 && `≈ ${formatDistance(pathMeters(points) * 1.3)} ו־${durationLabel(travel)} בדרכים`,
        first && `מתחילים ב-${first.item.time} (${first.place.name})`,
      ]
        .filter(Boolean)
        .join(' · '),
    })
  }

  // Entry tickets: about how much the day costs per person, and anything that must be booked and isn't.
  const entries = stops.flatMap(({ place }) => (place.entry ? [{ place, entry: place.entry }] : []))
  const entryCost = entries.reduce((sum, { entry }) => sum + (entry.entry === 'paid' || entry.entry === 'partly' ? entry.priceYen : 0), 0)
  if (entryCost > 0) {
    const rate = readCachedRate()
    lines.push({
      icon: <Ticket className="size-4" />,
      text: `כרטיסי כניסה היום: בערך ¥${entryCost.toLocaleString('en-US')} לאדם${rate ? ` (≈ ₪${Math.round(entryCost / rate.jpyPerIls)})` : ''}`,
    })
  }
  const unbooked = entries.find(
    ({ place, entry }) =>
      entry.bookAhead === 'required' && !place.booking?.booked && !tickets.some((ticket) => ticket.placeId === place.id),
  )
  if (unbooked) {
    lines.push({ icon: <Ticket className="size-4" />, text: `${unbooked.place.name} צריך כרטיס מראש, ועוד לא סומן שהוזמן`, tone: 'warn' })
  }

  if (forecast) {
    const windows = rainWindows(forecast)
    if (windows.length > 0) {
      rainy = true
      const ranges = windows.map(([from, to]) => `${hourLabel(from)}–${hourLabel(to)}`).join(', ')
      const wet = stops.find(({ item, place }) => {
        const minutes = parseHm(item.time)
        return OUTDOOR.has(place.category) && minutes != null && windows.some(([from, to]) => minutes >= from * 60 && minutes < to * 60)
      })
      lines.push({
        icon: <Umbrella className="size-4" />,
        text: `גשם צפוי ${ranges}, קחו מטריה${wet ? `. בדיוק אז אתם ב${wet.place.name}, בחוץ` : ''}`,
        tone: 'warn',
      })
    }
    const hot = forecast.max >= 30
    const cold = forecast.min <= 5
    lines.push({
      icon: <Thermometer className="size-4" />,
      text: `בין ${degrees(forecast.min)} ל-${degrees(forecast.max)}${hot ? ', חם: שתו הרבה מים' : cold ? ', קר: התלבשו חם' : ''}${
        windows.length === 0 && Math.max(...forecast.rainChance.map((chance) => chance ?? 0)) < 30 ? ', בלי גשם' : ''
      }`,
      ...(hot || cold ? { tone: 'warn' as const } : {}),
    })
    if (forecast.sunset) lines.push({ icon: <Sunset className="size-4" />, text: `שקיעה ב-${forecast.sunset}` })
  }

  return (
    <section aria-label="תדריך היום" className="surface rounded-card p-4">
      <h2 className="mb-2.5 flex items-center gap-2 text-sm font-semibold">
        <Sunrise aria-hidden className="size-4.5 text-accent" />
        תדריך היום
      </h2>
      <ul className="space-y-2">
        {lines.map((line) => (
          <li
            key={line.text}
            className={
              line.tone === 'warn' ? 'flex gap-2.5 text-sm font-medium text-amber-700 dark:text-amber-400' : 'flex gap-2.5 text-sm'
            }
          >
            <span aria-hidden className={line.tone === 'warn' ? 'mt-0.5 shrink-0' : 'mt-0.5 shrink-0 text-muted'}>
              {line.icon}
            </span>
            <span className="leading-relaxed">{line.text}</span>
          </li>
        ))}
      </ul>
      {rainy && stops.length > 0 && onRainPlan && (
        <button
          type="button"
          onClick={onRainPlan}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-500/12 px-3.5 py-2 text-sm font-semibold text-sky-700 transition active:scale-95 dark:text-sky-300"
        >
          <Umbrella aria-hidden className="size-4" />
          תוכנית ליום גשום
        </button>
      )}
    </section>
  )
}
