import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { ChevronLeft, Clock3, Droplets, MapPin, QrCode, Thermometer, Ticket, Umbrella } from 'lucide-react'
import type { LatLng, Trip } from '@/data/types'
import { photoFor, photoUrl } from '@/data/photos'
import { TRIP_TZ, minutesInTz, type TripTimeline } from '@/lib/dates'
import { describeWeather, fetchWeather, type Weather } from '@/lib/weather'
import type { DayAlert, DayBrief } from './dayBrief'
import { TICKETS_TODAY_ID } from './TicketsTodayCard'

interface TodayHeroProps {
  trip: Trip
  timeline: TripTimeline
  now: Date
  placeName: string
  location: LatLng
  /** Today's city (cities.ts), for its photo. */
  cityId?: string
  /** Names of today's stops: a landmark among them gets its own photo. */
  stops: string[]
  /** The day in a line, and what's worth a warning. */
  brief: DayBrief
  /** The rain alert opens the rainy-day plan. */
  onRainPlan?: () => void
}

const ALERT_ICON: Record<DayAlert['kind'], typeof Umbrella> = {
  rain: Umbrella,
  ticket: Ticket,
  tickets: QrCode,
  heat: Thermometer,
  cold: Thermometer,
}

/** Under the photo while it loads (or offline): the colours of the sky over Japan right now. */
function skyFor(japanMinutes: number) {
  const hour = japanMinutes / 60
  if (hour >= 5 && hour < 8) return 'linear-gradient(160deg, #f0876a 0%, #d6587c 48%, #5d4bb8 100%)'
  if (hour >= 8 && hour < 16.5) return 'linear-gradient(160deg, #3d8ef0 0%, #2a6be0 50%, #2347b8 100%)'
  if (hour >= 16.5 && hour < 19) return 'linear-gradient(160deg, #ee7a55 0%, #cd4675 48%, #5a37a3 100%)'
  return 'linear-gradient(160deg, #26346e 0%, #172054 55%, #0d1233 100%)'
}

const clock = (timeZone: string) => new Intl.DateTimeFormat('he-IL', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const japanClock = clock(TRIP_TZ)
const homeClock = clock('Asia/Jerusalem')

function JapanFlag() {
  return (
    <svg viewBox="0 0 30 20" aria-hidden className="h-3 w-[1.15rem] shrink-0 rounded-[2px] shadow-sm">
      <rect width="30" height="20" fill="#fff" />
      <circle cx="15" cy="10" r="6" fill="#bc002d" />
    </svg>
  )
}

function IsraelFlag() {
  return (
    <svg viewBox="0 0 220 160" aria-hidden className="h-3 w-[1.15rem] shrink-0 rounded-[2px] shadow-sm">
      <rect width="220" height="160" fill="#fff" />
      <rect y="15" width="220" height="25" fill="#0038b8" />
      <rect y="120" width="220" height="25" fill="#0038b8" />
      <path d="M110 50 136 95H84ZM110 110 84 65h52Z" fill="none" stroke="#0038b8" strokeWidth="6" />
    </svg>
  )
}

/**
 * The day at a glance, on a photo of where we are: the day of the trip, the city, the weather and
 * the time in Japan next to the time at home. The photo's own place shows in its corner.
 */
export function TodayHero({ trip, timeline, now, placeName, location, cityId, stops, brief, onRainPlan }: TodayHeroProps) {
  const weather = useWeather(location)
  const japanMinutes = minutesInTz(now)
  const night = japanMinutes < 6 * 60 || japanMinutes >= 18 * 60
  const { phase, dayNumber, daysUntil } = timeline
  const photo = photoFor({ cityId, stops, day: Math.max(0, dayNumber - 1), night })
  const [loaded, setLoaded] = useState<string | null>(null)
  const conditions = weather ? describeWeather(weather.code, weather.isDay) : null
  const WeatherIcon = conditions?.icon

  const status =
    phase === 'before'
      ? daysUntil === 1
        ? 'מחר טסים'
        : `עוד ${daysUntil} ימים לטיול`
      : phase === 'during'
        ? `יום ${dayNumber} מתוך ${trip.days}`
        : 'הטיול הסתיים'

  return (
    <section
      aria-label="היום בטיול"
      className="relative isolate overflow-hidden rounded-card text-white shadow-[0_16px_36px_-22px_rgb(20_30_60/0.7)] ring-1 ring-white/10 ring-inset text-shadow-xs text-shadow-black/35"
      style={{ background: skyFor(japanMinutes) }}
    >
      <img
        key={photo.id}
        src={photoUrl(photo)}
        alt=""
        aria-hidden
        draggable={false}
        onLoad={() => setLoaded(photo.id)}
        className={clsx(
          'absolute inset-0 -z-10 size-full object-cover transition-opacity duration-700',
          loaded === photo.id ? 'opacity-100' : 'opacity-0',
        )}
        style={{ objectPosition: photo.focus ?? 'center' }}
      />
      {/* Darker behind the text (the start side), clear over the rest of the photo. */}
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-l from-black/70 via-black/35 to-black/0" />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-16 bg-linear-to-t from-black/45 to-black/0" />

      <div className="flex min-h-44 flex-col items-start px-4 pt-3.5 pb-3">
        <p className="inline-flex items-center rounded-full bg-black/30 px-2.5 py-0.5 text-xs font-semibold backdrop-blur-sm">{status}</p>
        <p className="mt-1.5 max-w-[60%] truncate text-xl leading-tight font-bold">{placeName}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <p className="text-[3.25rem] leading-none font-semibold tracking-tighter tabular-nums" dir="ltr">
            {weather ? (
              `${Math.round(weather.temperature)}°`
            ) : (
              <span className="inline-block h-12 w-20 animate-pulse rounded-control bg-white/20 align-bottom" />
            )}
          </p>
          {WeatherIcon && <WeatherIcon aria-hidden className="size-8 shrink-0 drop-shadow" strokeWidth={1.7} />}
        </div>
        {weather && conditions && (
          <p className="mt-1 flex items-center gap-1.5 border-b border-white/45 pb-1 text-sm font-semibold">
            {conditions.label}
            <span className="font-normal text-white/90" dir="ltr">
              {Math.round(weather.max)}° / {Math.round(weather.min)}°
            </span>
            {weather.rainChance != null && weather.rainChance > 0 && (
              <span className="inline-flex items-center gap-0.5 font-normal text-white/90">
                <Droplets aria-hidden className="size-3.5" />
                {weather.rainChance}%
              </span>
            )}
          </p>
        )}
        <p className="mt-2 flex items-center gap-2 text-xs font-semibold tabular-nums">
          <span className="inline-flex items-center gap-1.5" aria-label={`ביפן ${japanClock.format(now)}`}>
            <JapanFlag />
            {japanClock.format(now)}
          </span>
          <Clock3 aria-hidden className="size-3.5 text-white/75" />
          <span className="inline-flex items-center gap-1.5" aria-label={`בבית ${homeClock.format(now)}`}>
            <IsraelFlag />
            {homeClock.format(now)}
          </span>
        </p>
        {brief.summary && <p className="mt-1.5 max-w-[56%] truncate text-xs text-white/85">{brief.summary}</p>}
      </div>

      {brief.alerts[0] && (
        <AlertChip
          alert={brief.alerts[0]}
          onOpen={brief.alerts[0].kind === 'rain' ? onRainPlan : brief.alerts[0].kind === 'tickets' ? showTickets : undefined}
        />
      )}

      <p className="absolute end-3 bottom-3 inline-flex max-w-[40%] items-center gap-1 rounded-full bg-black/35 px-2 py-1 text-[11px] font-medium backdrop-blur-sm">
        <MapPin aria-hidden className="size-3 shrink-0" />
        <span className="truncate">{photo.place}</span>
      </p>
    </section>
  )
}

/** Scrolls down to the day's entry tickets. */
function showTickets() {
  document.getElementById(TICKETS_TODAY_ID)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

/** The day's most important warning, in the photo's top corner. Rain opens the rainy-day plan. */
function AlertChip({ alert, onOpen }: { alert: DayAlert; onOpen?: () => void }) {
  const Icon = ALERT_ICON[alert.kind]
  const className =
    'absolute end-3 top-3 inline-flex max-w-[48%] items-center gap-1 rounded-full bg-amber-300/95 px-2.5 py-1 text-[11px] font-semibold text-amber-950 shadow-sm text-shadow-none'
  const body = (
    <>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{alert.short}</span>
      {onOpen && <ChevronLeft aria-hidden className="-me-0.5 size-3.5 shrink-0" />}
    </>
  )
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      aria-label={alert.kind === 'rain' ? `${alert.text}. לתוכנית ליום גשום` : alert.text}
      className={className}
    >
      {body}
    </button>
  ) : (
    <p role="note" aria-label={alert.text} className={className}>
      {body}
    </p>
  )
}

/** Current weather at `location`, refreshed every 30 minutes. */
function useWeather({ lat, lng }: LatLng): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const load = () => fetchWeather({ lat, lng }, controller.signal).then(setWeather, () => undefined)
    void load()
    const timer = setInterval(load, 30 * 60_000)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [lat, lng])

  return weather
}
