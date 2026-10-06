import { useMemo } from 'react'
import { motion, type Variants } from 'motion/react'
import { ClockStrip } from '@/components/today/ClockStrip'
import { CurrencyCard } from '@/components/today/CurrencyCard'
import { DayHero } from '@/components/today/DayHero'
import { FlightCountdown } from '@/components/today/FlightCountdown'
import { DayTimeline } from '@/components/today/DayTimeline'
import { NextUpCard } from '@/components/today/NextUpCard'
import { Toolkit } from '@/components/today/Toolkit'
import { WeatherCard } from '@/components/today/WeatherCard'
import { Avatar } from '@/components/ui/Avatar'
import { DEFAULT_CITY, getCity } from '@/data/cities'
import { sortedDay } from '@/data/planOps'
import { useNow } from '@/hooks/useNow'
import { formatDay, greetingFor, minutesInTz, parseHm, tripTimeline, weekdayKanji } from '@/lib/dates'
import { useCurrentUser } from '@/store/session'
import { useTrip, useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

/**
 * "Today" dashboard, the first page of the travel notebook: the day stamp, what's next,
 * weather + yen/shekel converter, the flight pass (once a flight is set), Japan/home clocks,
 * the pocket tools and today's timeline.
 * Before the trip it previews day 1; after it, the last day.
 */
export default function TodayScreen() {
  const now = useNow(30_000)
  const user = useCurrentUser()
  const trip = useTrip()
  const plan = useTripStore((state) => state.plan)
  const placesById = useTripStore((state) => state.placesById)

  const timeline = tripTimeline(trip, now)
  const { phase, focusDate, dayNumber } = timeline
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

  const today = timeline.today

  return (
    <motion.div variants={STAGGER} initial="hidden" animate="shown" className="pt-screen mx-auto w-full max-w-md px-5">
      <motion.header variants={RISE} className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-muted">
            {formatDay(today, { weekday: 'long', day: 'numeric', month: 'long' })}
            <span lang="ja" className="font-jp text-xs font-semibold tracking-wider">
              {weekdayKanji(today)}
            </span>
          </p>
          <h1 className="mt-1 text-[2.15rem] leading-[1.1] font-bold">
            {greetingFor(now)}, {user.username}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => ui.setProfileOpen(true)}
          aria-label="פרופיל והגדרות הטיול"
          className="mt-1 rounded-full ring-2 ring-card transition active:scale-90"
        >
          <Avatar name={user.username} className="size-11 text-lg" />
        </button>
      </motion.header>

      <motion.div variants={RISE} className="mt-5">
        <DayHero trip={trip} timeline={timeline} city={city} />
      </motion.div>

      {next && nextPlace && (
        <motion.div variants={RISE} className="mt-4">
          <NextUpCard
            item={next}
            place={nextPlace}
            nowMinutes={nowMinutes}
            eyebrow={phase === 'during' ? 'הדבר הבא' : 'הפעילות הראשונה בטיול'}
          />
        </motion.div>
      )}

      <motion.div variants={RISE} className="mt-4 grid grid-cols-2 gap-3">
        <WeatherCard location={weatherLocation} placeName={weatherName} />
        <CurrencyCard />
      </motion.div>

      <motion.div variants={RISE} className="mt-3 empty:hidden">
        <FlightCountdown flights={trip.flights} />
      </motion.div>

      <motion.div variants={RISE} className="mt-3">
        <ClockStrip />
      </motion.div>

      <motion.section variants={RISE} className="mt-7" aria-label="כלים לדרך">
        <h2 className="mb-3 text-sm font-bold text-muted">כלים לדרך</h2>
        <Toolkit />
      </motion.section>

      <motion.section variants={RISE} className="mt-8">
        <h2 className="mb-4 flex items-baseline justify-between">
          <span className="font-display text-xl font-bold">{phase === 'during' ? 'הלו״ז של היום' : `יום ${dayNumber}`}</span>
          <span className="text-sm text-muted">{formatDay(focusDate, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </h2>
        <DayTimeline items={items} placesById={placesById} nowMinutes={nowMinutes} nextItemId={next?.id ?? null} />
      </motion.section>
    </motion.div>
  )
}

/** Cards rise in one after another on first open. */
const STAGGER: Variants = { hidden: {}, shown: { transition: { staggerChildren: 0.05 } } }
const RISE: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 30 } },
}
