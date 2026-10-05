import { useMemo } from 'react'
import { motion } from 'motion/react'
import { FlightCountdown } from '@/components/today/FlightCountdown'
import { DayTimeline } from '@/components/today/DayTimeline'
import { NextUpCard } from '@/components/today/NextUpCard'
import { WeatherCard } from '@/components/today/WeatherCard'
import { Avatar } from '@/components/ui/Avatar'
import { DEFAULT_CITY, getCity } from '@/data/cities'
import { sortedDay } from '@/data/planOps'
import { useNow } from '@/hooks/useNow'
import { formatDay, greetingFor, minutesInTz, parseHm, tripTimeline } from '@/lib/dates'
import { useCurrentUser } from '@/store/session'
import { useTrip, useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

/**
 * "Today" dashboard — only what matters right now:
 * greeting + weather + flight countdown, the next activity, and today's timeline.
 * Before the trip it previews day 1; after it, the last day.
 */
export default function TodayScreen() {
  const now = useNow(30_000)
  const user = useCurrentUser()
  const trip = useTrip()
  const plan = useTripStore((state) => state.plan)
  const placesById = useTripStore((state) => state.placesById)

  const timeline = tripTimeline(trip, now)
  const { phase, focusDate, dayNumber, daysUntil } = timeline
  const items = useMemo(
    () => sortedDay(plan[focusDate]).filter((item) => placesById[item.placeId]),
    [plan, focusDate, placesById],
  )

  const nowMinutes = phase === 'during' ? minutesInTz(now) : null
  const next =
    phase === 'during'
      ? items.find((item) => {
          const minutes = parseHm(item.time)
          return minutes != null && nowMinutes != null && minutes + 15 >= nowMinutes
        })
      : phase === 'before'
        ? items[0]
        : undefined
  const nextPlace = next ? placesById[next.placeId] : undefined

  const city = getCity(trip.dayCities[focusDate])
  const firstPlace = items[0] ? placesById[items[0].placeId] : undefined
  const weatherLocation = city?.location ?? firstPlace?.location ?? DEFAULT_CITY.location
  const weatherName = city?.name ?? (firstPlace ? 'היעד של היום' : DEFAULT_CITY.name)

  const status =
    phase === 'before'
      ? daysUntil === 1
        ? 'מחר טסים! ✈️'
        : `עוד ${daysUntil} ימים לטיול`
      : phase === 'during'
        ? `יום ${dayNumber} מתוך ${trip.days}${city ? ` · ${city.name}` : ''}`
        : 'הטיול הסתיים. איזה כיף היה!'

  return (
    <div className="pt-screen mx-auto w-full max-w-md px-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{status}</p>
          <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight">
            {greetingFor(now)}, {user.username}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => ui.setProfileOpen(true)}
          aria-label="פרופיל והגדרות הטיול"
          className="mt-1 rounded-full ring-2 ring-white/70 transition active:scale-90 dark:ring-white/10"
        >
          <Avatar name={user.username} className="size-11 text-lg" />
        </button>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-5 grid grid-cols-2 gap-3"
      >
        <WeatherCard location={weatherLocation} placeName={weatherName} />
        <FlightCountdown flights={trip.flights} />
      </motion.div>

      {next && nextPlace && (
        <div className="mt-5">
          <NextUpCard
            item={next}
            place={nextPlace}
            nowMinutes={nowMinutes}
            eyebrow={phase === 'during' ? 'הדבר הבא' : 'הפעילות הראשונה בטיול'}
          />
        </div>
      )}

      <section className="mt-7">
        <h2 className="mb-4 flex items-baseline justify-between">
          <span className="text-lg font-bold">{phase === 'during' ? 'הלו״ז של היום' : `יום ${dayNumber}`}</span>
          <span className="text-sm text-muted">{formatDay(focusDate, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </h2>
        <DayTimeline items={items} placesById={placesById} nowMinutes={nowMinutes} nextItemId={next?.id ?? null} />
      </section>
    </div>
  )
}
