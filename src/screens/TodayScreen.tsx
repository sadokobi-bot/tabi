import { useMemo, useState } from 'react'
import { firstName } from '@/backend'
import { JoinRequests } from '@/components/profile/JoinRequests'
import { JapaneseYen, Languages, Route } from 'lucide-react'
import { motion, type Variants } from 'motion/react'
import { useNavigate } from 'react-router'
import { BookingsCard } from '@/components/today/BookingsCard'
import { CurrencyCard } from '@/components/today/CurrencyCard'
import { DayTimeline } from '@/components/today/DayTimeline'
import { FlightCountdown } from '@/components/today/FlightCountdown'
import { NextUpCard } from '@/components/today/NextUpCard'
import { TicketsTodayCard } from '@/components/today/TicketsTodayCard'
import { LuggageRow } from '@/components/today/LuggageRow'
import { LuggageSheet } from '@/components/place/LuggageSheet'
import { moveOn, type HotelMove } from '@/data/luggage'
import { TodayHero } from '@/components/today/TodayHero'
import { useDayBrief } from '@/components/today/dayBrief'
import { TransitGuideRow } from '@/components/today/TransitSheets'
import { TranslateSheet } from '@/components/today/TranslateSheet'
import { PlanDaySheet } from '@/components/trip/PlanDaySheet'
import { RainPlanSheet } from '@/components/trip/RainPlan'
import { PinnedMeet } from '@/components/chat/ChatStatus'
import { hasFirebase } from '@/config/env'
import { CheckoutRow, TonightRow } from '@/components/today/TonightRow'
import { Avatar } from '@/components/ui/Avatar'
import { DEFAULT_CITY, getCity, nearestCity } from '@/data/cities'
import { sortedDay } from '@/data/planOps'
import { stayFor } from '@/data/stays'
import { useNow } from '@/hooks/useNow'
import { addDays, formatDay, greetingFor, minutesInTz, parseHm, tripTimeline } from '@/lib/dates'
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
  const messages = useTripStore((state) => state.messages)
  const places = useTripStore((state) => state.places)
  const navigate = useNavigate()
  const [planning, setPlanning] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [luggage, setLuggage] = useState<HotelMove | null>(null)
  const [rainPlanning, setRainPlanning] = useState(false)
  const [currencyHidden, setCurrencyHidden] = useState(readCurrencyHidden)
  const showCurrency = (show: boolean) => {
    setCurrencyHidden(!show)
    try {
      localStorage.setItem(CURRENCY_HIDDEN_KEY, show ? '0' : '1')
    } catch {
      // Not remembered (private mode).
    }
  }

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
  // Hotel changes today: check out of last night's, check in to tonight's.
  const lastNightId = stayFor(trip.stays, addDays(focusDate, -1))
  const checkingOut = lastNightId && lastNightId !== stayId ? placesById[lastNightId] : undefined

  // Hotel changes: tomorrow's (send the suitcases tonight) and today's.
  const moveTomorrow = moveOn(trip, placesById, addDays(focusDate, 1))
  const moveToday = phase === 'during' ? moveOn(trip, placesById, focusDate) : null

  const city = getCity(trip.dayCities[focusDate])
  const firstPlace = items[0] ? placesById[items[0].placeId] : undefined
  const weatherLocation = city?.location ?? firstPlace?.location ?? DEFAULT_CITY.location
  const placeName = city?.name ?? (firstPlace ? 'היעד של היום' : DEFAULT_CITY.name)
  const brief = useDayBrief({
    date: focusDate,
    items: phase === 'after' ? [] : items,
    placesById,
    location: weatherLocation,
    start: lastNightId ? placesById[lastNightId] : undefined,
  })

  return (
    <motion.div variants={STAGGER} initial="hidden" animate="shown" className="pt-screen mx-auto w-full max-w-md lg:max-w-2xl px-5">
      <motion.header variants={RISE} className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-[1.85rem] leading-tight font-bold tracking-tight">
            {greetingFor(now)}, {firstName(user)}
          </h1>
          <p className="mt-1 text-sm text-muted">{formatDay(timeline.today, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {currencyHidden && (
            <button
              type="button"
              onClick={() => showCurrency(true)}
              aria-label="הצגת ממיר המטבע"
              className="glass grid size-11 place-items-center rounded-full text-accent transition active:scale-90"
            >
              <JapaneseYen aria-hidden className="size-5" />
            </button>
          )}
          {/* Photo translation runs on Gemini through Firebase, so it needs cloud mode. */}
          {hasFirebase && (
            <button
              type="button"
              onClick={() => setTranslating(true)}
              aria-label="תרגום תפריט או שלט מתמונה"
              className="glass grid size-11 place-items-center rounded-full text-accent transition active:scale-90"
            >
              <Languages aria-hidden className="size-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => ui.setProfileOpen(true)}
            aria-label="פרופיל והגדרות הטיול"
            data-tour="profile"
            className="tap-target relative rounded-full transition active:scale-90"
          >
            <Avatar name={firstName(user)} className="size-11 text-lg" />
          </button>
        </div>
      </motion.header>
      <TranslateSheet open={translating} onClose={() => setTranslating(false)} />

      {/* A meeting point set in the chat. */}
      <motion.div variants={RISE} className="mt-5 empty:hidden">
        <PinnedMeet messages={messages} />
      </motion.div>

      {/* The trip's owner approves who joins. */}
      {trip.ownerId === user.uid && (
        <motion.div variants={RISE} className="mt-5 empty:hidden">
          <JoinRequests />
        </motion.div>
      )}

      <motion.div variants={RISE} className="mt-5">
        <TodayHero
          trip={trip}
          timeline={timeline}
          now={now}
          placeName={placeName}
          location={weatherLocation}
          cityId={city?.id ?? (firstPlace ? nearestCity(firstPlace.location)?.id : DEFAULT_CITY.id)}
          stops={items.flatMap((item) => placesById[item.placeId]?.name ?? [])}
          brief={brief}
          onRainPlan={hasFirebase && items.length > 0 ? () => setRainPlanning(true) : undefined}
        />
      </motion.div>

      {/* The converter stays right under the card (unless put away; the ¥ button in the header brings it back). */}
      {!currencyHidden && (
        <motion.div variants={RISE} className="mt-3">
          <CurrencyCard onHide={() => showCurrency(false)} />
        </motion.div>
      )}

      {next && nextPlace && (
        <motion.div variants={RISE} className="mt-3">
          <NextUpCard
            date={focusDate}
            item={next}
            place={nextPlace}
            nowMinutes={nowMinutes}
            eyebrow={phase === 'during' ? 'הדבר הבא' : 'הפעילות הראשונה בטיול'}
          />
        </motion.div>
      )}

      <motion.div variants={RISE} className="mt-3 empty:hidden">
        <TicketsTodayCard items={items} placesById={placesById} />
      </motion.div>

      {moveToday && (
        <motion.div variants={RISE} className="mt-3">
          <LuggageRow move={moveToday} when="today" onOpen={() => setLuggage(moveToday)} />
        </motion.div>
      )}

      {checkingOut && (
        <motion.div variants={RISE} className="mt-3">
          <CheckoutRow place={checkingOut} />
        </motion.div>
      )}

      {stay && (
        <motion.div variants={RISE} className="mt-3">
          <TonightRow place={stay} checkInToday={stayId !== lastNightId} />
        </motion.div>
      )}

      {moveTomorrow && (
        <motion.div variants={RISE} className="mt-3">
          <LuggageRow move={moveTomorrow} when="tonight" onOpen={() => setLuggage(moveTomorrow)} />
        </motion.div>
      )}
      <LuggageSheet move={luggage} onClose={() => setLuggage(null)} />

      <motion.div variants={RISE} className="mt-3 empty:hidden">
        <FlightCountdown flights={trip.flights} />
      </motion.div>

      <motion.div variants={RISE} className="mt-3 empty:hidden">
        <BookingsCard places={places} today={timeline.today} />
      </motion.div>

      <motion.section variants={RISE} className="surface mt-7 rounded-card p-4">
        <h2 className="mb-4 flex items-center justify-between gap-3">
          <span className="text-lg font-bold tracking-tight">{phase === 'during' ? 'הלו״ז של היום' : `יום ${dayNumber}`}</span>
          {items.length > 1 && (
            <button
              type="button"
              onClick={() => {
                ui.showRoute(focusDate)
                navigate('/map')
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3.5 py-2 text-sm font-semibold text-accent transition active:scale-95"
            >
              <Route aria-hidden className="size-4" />
              המסלול במפה
            </button>
          )}
        </h2>
        <DayTimeline
          date={focusDate}
          items={items}
          placesById={placesById}
          nowMinutes={nowMinutes}
          nextItemId={next?.id ?? null}
          onPlan={hasFirebase ? () => setPlanning(true) : undefined}
        />
      </motion.section>

      <motion.div variants={RISE} className="mt-6">
        <TransitGuideRow />
      </motion.div>
      <PlanDaySheet date={planning ? focusDate : null} onClose={() => setPlanning(false)} />
      <RainPlanSheet date={rainPlanning ? focusDate : null} onClose={() => setRainPlanning(false)} />
    </motion.div>
  )
}

/** Cards rise in one after another when the screen first opens. */
const CURRENCY_HIDDEN_KEY = 'tabi:currencyHidden'
function readCurrencyHidden() {
  try {
    return localStorage.getItem(CURRENCY_HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

const STAGGER: Variants = { hidden: {}, shown: { transition: { staggerChildren: 0.05 } } }
const RISE: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 30 } },
}
