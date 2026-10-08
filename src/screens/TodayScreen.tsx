import { useMemo } from 'react'
import { Route } from 'lucide-react'
import { motion, type Variants } from 'motion/react'
import { useNavigate } from 'react-router'
import { BookingsCard } from '@/components/today/BookingsCard'
import { CurrencyCard } from '@/components/today/CurrencyCard'
import { DayTimeline } from '@/components/today/DayTimeline'
import { FlightCountdown } from '@/components/today/FlightCountdown'
import { NextUpCard } from '@/components/today/NextUpCard'
import { TodayHero } from '@/components/today/TodayHero'
import { TonightRow } from '@/components/today/TonightRow'
import { Avatar } from '@/components/ui/Avatar'
import { DEFAULT_CITY, getCity } from '@/data/cities'
import { sortedDay } from '@/data/planOps'
import { stayFor } from '@/data/stays'
import { useNow } from '@/hooks/useNow'
import { formatDay, greetingFor, minutesInTz, parseHm, tripTimeline } from '@/lib/dates'
import { useCurrentUser } from '@/store/session'
import { useTrip, useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

/**
 * "Today": everything about this one day and nothing else.
 * The day card (where we are in the trip, weather, Japan/home time), what's next, a quick
 * yen/shekel converter, the flight (when one is coming up) and the day's schedule.
 * Before the trip it previews day 1; after it, the last day.
 */
export default function TodayScreen() {
  const now = useNow(30_000)
  const user = useCurrentUser()
  const trip = useTrip()
  const plan = useTripStore((state) => state.plan)
  const placesById = useTripStore((state) => state.placesById)
  const places = useTripStore((state) => state.places)
  const navigate = useNavigate()

  const timeline = tripTimeline(trip, now)
  const { phase, focusDate, dayNumber } = timeline
  const items = useMemo(() => sortedDay(plan[focusDate]).filter((item) => placesById[item.placeId]), [plan, focusDate, placesById])

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

  const stayId = stayFor(trip.stays, focusDate)
  const stay = stayId ? placesById[stayId] : undefined

  const city = getCity(trip.dayCities[focusDate])
  const firstPlace = items[0] ? placesById[items[0].placeId] : undefined
  const weatherLocation = city?.location ?? firstPlace?.location ?? DEFAULT_CITY.location
  const placeName = city?.name ?? (firstPlace ? 'היעד של היום' : DEFAULT_CITY.name)

  return (
    <motion.div variants={STAGGER} initial="hidden" animate="shown" className="pt-screen mx-auto w-full max-w-md px-5">
      <motion.header variants={RISE} className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-[1.85rem] leading-tight font-bold tracking-tight">
            {greetingFor(now)}, {user.username}
          </h1>
          <p className="mt-1 text-sm text-muted">{formatDay(timeline.today, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button
          type="button"
          onClick={() => ui.setProfileOpen(true)}
          aria-label="פרופיל והגדרות הטיול"
          className="tap-target relative rounded-full transition active:scale-90"
        >
          <Avatar name={user.username} className="size-11 text-lg" />
        </button>
      </motion.header>

      <motion.div variants={RISE} className="mt-5">
        <TodayHero trip={trip} timeline={timeline} now={now} placeName={placeName} location={weatherLocation} />
      </motion.div>

      {next && nextPlace && (
        <motion.div variants={RISE} className="mt-3">
          <NextUpCard
            item={next}
            place={nextPlace}
            nowMinutes={nowMinutes}
            eyebrow={phase === 'during' ? 'הדבר הבא' : 'הפעילות הראשונה בטיול'}
          />
        </motion.div>
      )}

      {stay && (
        <motion.div variants={RISE} className="mt-3">
          <TonightRow place={stay} />
        </motion.div>
      )}

      <motion.div variants={RISE} className="mt-3 empty:hidden">
        <FlightCountdown flights={trip.flights} />
      </motion.div>

      <motion.div variants={RISE} className="mt-3 empty:hidden">
        <BookingsCard places={places} today={timeline.today} />
      </motion.div>

      <motion.div variants={RISE} className="mt-3">
        <CurrencyCard />
      </motion.div>

      <motion.section variants={RISE} className="mt-7">
        <h2 className="mb-4 flex items-baseline justify-between">
          <span className="text-lg font-bold tracking-tight">{phase === 'during' ? 'הלו״ז של היום' : `יום ${dayNumber}`}</span>
          <span className="text-sm text-muted">{formatDay(focusDate, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </h2>
        {items.length > 1 && (
          <button
            type="button"
            onClick={() => {
              ui.showRoute(focusDate)
              navigate('/map')
            }}
            className="-mt-1 mb-4 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3.5 py-2 text-sm font-semibold text-accent transition active:scale-95"
          >
            <Route aria-hidden className="size-4" />
            המסלול של היום במפה
          </button>
        )}
        <DayTimeline date={focusDate} items={items} placesById={placesById} nowMinutes={nowMinutes} nextItemId={next?.id ?? null} />
      </motion.section>
    </motion.div>
  )
}

/** Cards rise in one after another when the screen first opens. */
const STAGGER: Variants = { hidden: {}, shown: { transition: { staggerChildren: 0.05 } } }
const RISE: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 30 } },
}
