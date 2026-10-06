import { useEffect, useState } from 'react'
import { Droplets } from 'lucide-react'
import type { LatLng, Trip } from '@/data/types'
import { TRIP_TZ, minutesInTz, type TripTimeline } from '@/lib/dates'
import { describeWeather, fetchWeather, type Weather } from '@/lib/weather'

interface TodayHeroProps {
  trip: Trip
  timeline: TripTimeline
  now: Date
  placeName: string
  location: LatLng
}

type Sky = 'dawn' | 'day' | 'dusk' | 'night' | 'rain'

/** Sky gradients: the card looks like the sky over Japan right now. */
const SKIES: Record<Sky, { background: string; glow: string }> = {
  dawn: { background: 'linear-gradient(160deg, #f0876a 0%, #d6587c 48%, #5d4bb8 100%)', glow: 'rgb(255 228 196 / 0.45)' },
  day: { background: 'linear-gradient(160deg, #3d8ef0 0%, #2a6be0 50%, #2347b8 100%)', glow: 'rgb(255 255 255 / 0.32)' },
  dusk: { background: 'linear-gradient(160deg, #ee7a55 0%, #cd4675 48%, #5a37a3 100%)', glow: 'rgb(255 208 164 / 0.42)' },
  night: { background: 'linear-gradient(160deg, #26346e 0%, #172054 55%, #0d1233 100%)', glow: 'rgb(170 190 255 / 0.25)' },
  rain: { background: 'linear-gradient(160deg, #6f819c 0%, #526480 55%, #384660 100%)', glow: 'rgb(255 255 255 / 0.18)' },
}

function skyFor(japanMinutes: number, weather: Weather | null): Sky {
  if (weather && (weather.code >= 51 || weather.code === 45 || weather.code === 48)) return 'rain'
  const hour = japanMinutes / 60
  if (hour >= 5 && hour < 8) return 'dawn'
  if (hour >= 8 && hour < 16.5) return 'day'
  if (hour >= 16.5 && hour < 19) return 'dusk'
  return 'night'
}

const clock = (timeZone: string) => new Intl.DateTimeFormat('he-IL', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const japanClock = clock(TRIP_TZ)
const homeClock = clock('Asia/Jerusalem')

/**
 * The day at a glance: where we are in the trip, the weather at today's stop and the time
 * in Japan next to the time at home, on a card painted like the current sky in Japan.
 */
export function TodayHero({ trip, timeline, now, placeName, location }: TodayHeroProps) {
  const weather = useWeather(location)
  const sky = SKIES[skyFor(minutesInTz(now), weather)]
  const { phase, dayNumber, daysUntil } = timeline
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
  const progress = phase === 'before' ? 0 : phase === 'during' ? dayNumber / trip.days : 1

  return (
    <section
      aria-label="היום בטיול"
      className="relative isolate overflow-hidden rounded-card p-5 text-white shadow-[0_16px_36px_-22px_rgb(30_50_120/0.6)] ring-1 ring-white/10 ring-inset transition-[background] duration-700 text-shadow-xs text-shadow-black/25"
      style={{ background: sky.background }}
    >
      {/* Keeps small white text readable on the lighter skies (dawn, day, dusk). */}
      <span aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/12 via-black/0 to-black/18" />
      {/* sun / moon glow */}
      <span
        aria-hidden
        className="pointer-events-none absolute -end-16 -top-20 size-56 rounded-full"
        style={{ background: `radial-gradient(closest-side, ${sky.glow}, transparent)` }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center rounded-full bg-black/18 px-2.5 py-1 text-xs font-semibold backdrop-blur-sm">{status}</p>
          <p className="mt-2 truncate text-sm font-semibold">{placeName}</p>
        </div>
        {WeatherIcon && <WeatherIcon aria-hidden className="size-11 shrink-0 drop-shadow" strokeWidth={1.6} />}
      </div>

      <div className="relative mt-1 flex items-end justify-between gap-3">
        <p className="text-[4rem] leading-none font-semibold tracking-tighter tabular-nums" dir="ltr">
          {weather ? `${Math.round(weather.temperature)}°` : <span className="inline-block h-14 w-24 animate-pulse rounded-control bg-white/20 align-bottom" />}
        </p>
        {weather && conditions && (
          <div className="mb-1.5 text-end text-sm">
            <p className="font-semibold">{conditions.label}</p>
            <p className="text-white/90">
              <span dir="ltr">
                {Math.round(weather.max)}° / {Math.round(weather.min)}°
              </span>
              {weather.rainChance != null && weather.rainChance > 0 && (
                <span className="ms-2 inline-flex items-center gap-0.5">
                  <Droplets aria-hidden className="size-3.5" />
                  {weather.rainChance}%
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="relative mt-4 h-1 overflow-hidden rounded-full bg-white/22" role="presentation">
        <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(progress * 100, phase === 'before' ? 0 : 3)}%` }} />
      </div>

      <p className="relative mt-3 flex items-center justify-between text-xs text-white/90 tabular-nums">
        <span>
          ביפן <span className="font-semibold text-white">{japanClock.format(now)}</span>
        </span>
        <span>
          בבית <span className="font-semibold text-white">{homeClock.format(now)}</span>
        </span>
      </p>
    </section>
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
