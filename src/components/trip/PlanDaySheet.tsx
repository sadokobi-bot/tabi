import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { BookmarkCheck, CalendarCheck, MapPin, RefreshCw, ShieldCheck, Sparkles, Umbrella } from 'lucide-react'
import { motion } from 'motion/react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { TextAreaField } from '@/components/ui/TextField'
import { actions } from '@/data/actions'
import { getCity, nearestCity } from '@/data/cities'
import { insertByTime, sortedDay } from '@/data/planOps'
import { stayFor } from '@/data/stays'
import type { ItineraryItem } from '@/data/types'
import { FAILURE_TEXT, failureOf, nameMatch, planDayWithAi, resolveOnMap, type AssistantFailure, type PlannedStop } from '@/lib/assistant'
import { distanceMeters } from '@/lib/geo'
import { addDays, formatDay, tripDates } from '@/lib/dates'
import { newId } from '@/lib/ids'
import type { Poi } from '@/maps/poi'
import { usePoiProvider } from '@/maps/usePoiProvider'
import { dietOf, findRestaurants } from '@/lib/mealOptions'
import { useTrip, useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'
import { RainPlan } from './RainPlan'

const INTERESTS = [
  'מקדשים ותרבות',
  'אוכל רחוב',
  'מסעדות טובות',
  'טבע ונוף',
  'קניות',
  'מוזיאונים ואמנות',
  'בתי קפה',
  'חיי לילה',
  'אנימה וגיימינג',
]

const LOCATE_TIMEOUT_MS = 10_000

/** A stop the AI suggested, checked on the map: its real map entry (none for saved places). */
type Checked = PlannedStop & { poi?: Poi }

/** What the plan does about a kosher wish: written by the app from the plan itself, not by the AI. */
type DietNote = { tone: 'ok' | 'warn'; text: string }

type Phase =
  | { name: 'form' }
  | { name: 'loading'; step: string }
  | { name: 'result'; reply: string; stops: Checked[]; inDay: Set<string>; removed: number; dietNote?: DietNote }
  | { name: 'error'; failure: AssistantFailure }

/** "Plan my day": Gemini builds the day around what's fixed, from saved places and real recommendations. */
export function PlanDaySheet({ date, onClose }: { date: string | null; onClose: () => void }) {
  // Portaled: tab panels are their own stacking contexts, under the tab bar.
  return createPortal(
    <BottomSheet open={date !== null} onClose={onClose} label="תכנון יום">
      {date && <PlanDay key={date} date={date} onClose={onClose} />}
    </BottomSheet>,
    document.body,
  )
}

function PlanDay({ date, onClose }: { date: string; onClose: () => void }) {
  const trip = useTrip()
  const provider = usePoiProvider()
  const [interests, setInterests] = useState<string[]>([])
  const [wishes, setWishes] = useState('')
  const [relaxed, setRelaxed] = useState(false)
  const [phase, setPhase] = useState<Phase>({ name: 'form' })
  const [rain, setRain] = useState(false)
  const hasStops = useTripStore((state) => (state.plan[date]?.length ?? 0) > 0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const dayNumber = tripDates(trip).indexOf(date) + 1
  const hotelId = stayFor(trip.stays, addDays(date, -1))

  const generate = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPhase({ name: 'loading', step: 'מחפשים מסעדות אמיתיות באזור…' })
    const { plan, places, placesById } = useTripStore.getState()
    const hotel = hotelId ? placesById[hotelId] : undefined
    const city = getCity(trip.dayCities[date]) ?? (hotel ? nearestCity(hotel.location) : undefined)
    const scheduled = new Set(Object.values(plan).flatMap((items) => items.map((item) => item.placeId)))
    const saved = places.filter(
      (place) => !scheduled.has(place.id) && place.category !== 'hotel' && (!city || nearestCity(place.location)?.id === city.id),
    )
    const fixed = sortedDay(plan[date]).flatMap((item) => {
      const place = placesById[item.placeId]
      return place ? [{ id: place.id, ...(item.time ? { time: item.time } : {}), name: place.name }] : []
    })
    const inDay = new Set(fixed.map((stop) => stop.id))
    const elsewhere = places.filter(
      (place) => scheduled.has(place.id) && !inDay.has(place.id) && (!city || nearestCity(place.location)?.id === city.id),
    )
    const wishText = [interests.join(', '), wishes].filter(Boolean).join('. ')
    const firstFixed = fixed[0] ? placesById[fixed[0].id] : undefined
    const center = city?.location ?? hotel?.location ?? firstFixed?.location ?? null

    try {
      // Meals come only from restaurants that are really on the map (the AI used to invent some).
      const restaurants = await findRestaurants(provider, center, wishText)
      if (controller.signal.aborted) return
      setPhase({ name: 'loading', step: 'מתכננים לכם יום…' })
      const answer = await planDayWithAi({
        area: city?.en ?? '',
        dateLabel: new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
        wishes: wishText,
        relaxed,
        saved: saved.slice(0, 60).map(({ id, name, category }) => ({ id, name, category })),
        fixed,
        elsewhere: elsewhere.slice(0, 40).map((place) => place.name),
        ...(hotel ? { hotel: hotel.name } : {}),
        restaurants: restaurants.options,
      })
      if (controller.signal.aborted) return
      // A "new" suggestion that is really one of our saved places (named a little differently) links to it.
      const stops = answer.stops.map((stop) => {
        if (stop.savedId) return stop
        const match = places.find(
          (place) =>
            (nameMatch(stop.name, place.name) >= 0.5 || nameMatch(stop.searchName, place.name) >= 0.5) &&
            distanceMeters(stop.location, place.location) <= 1500,
        )
        return match ? { ...stop, savedId: match.id } : stop
      })
      // Never the same place twice in one day.
      const seen = new Set<string>()
      const unique = stops.filter((stop) => !stop.savedId || (!seen.has(stop.savedId) && seen.add(stop.savedId)))
      // Every new place is checked on the map before it's shown: one that isn't there is dropped.
      setPhase({ name: 'loading', step: 'בודקים שכל המקומות באמת קיימים…' })
      const checked = await Promise.all(
        unique.map(async (stop): Promise<Checked | null> => {
          if (stop.savedId) return stop
          // A restaurant from the map: its real name (the AI's Hebrew rendering can be wrong: "Chabad" → "חברון").
          const restaurant = stop.restaurantId ? restaurants.pois[stop.restaurantId] : undefined
          if (restaurant) return { ...stop, name: restaurant.name, poi: restaurant }
          try {
            const poi = await Promise.race([
              resolveOnMap(stop, provider, controller.signal),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATE_TIMEOUT_MS)),
            ])
            return poi && !poi.key.startsWith('ai:') ? { ...stop, poi } : null
          } catch {
            return null
          }
        }),
      )
      if (controller.signal.aborted) return
      const real = checked.filter((stop): stop is Checked => stop !== null)
      if (real.length === 0) {
        setPhase({ name: 'error', failure: 'other' })
        return
      }
      // Kosher only counts when the place says so in its name (and was found looking for kosher food).
      const kosher = dietOf(wishText) === 'kosher'
      const kosherStop = real.find((stop) => {
        const option = restaurants.options.find((o) => o.id === stop.restaurantId)
        return option?.foundBy === 'kosher restaurant' && /kosher|chabad|כשר/i.test(option.name)
      })
      const dietNote: DietNote | undefined = !kosher
        ? undefined
        : kosherStop
          ? { tone: 'ok', text: `כולל מסעדה כשרה: ${kosherStop.name}` }
          : { tone: 'warn', text: 'לא מצאנו מסעדה כשרה באזור, אז הארוחות הן במסעדות צמחוניות או טבעוניות.' }
      setPhase({ name: 'result', reply: answer.reply, stops: real, inDay, removed: unique.length - real.length, dietNote })
    } catch (error) {
      console.error('[plan] failed', error)
      setPhase({ name: 'error', failure: failureOf(error) })
    }
  }

  // The same sheet, for the rainy-day version of a day that's already planned.
  if (rain) return <RainPlan date={date} onDone={onClose} />

  const save = (stops: Checked[]) => {
    const { plan } = useTripStore.getState()
    let items: ItineraryItem[] = [...(plan[date] ?? [])]
    const inDay = new Set(items.map((item) => item.placeId))
    let added = 0
    for (const stop of stops) {
      let placeId = stop.savedId
      if (!placeId) {
        const poi = stop.poi
        placeId = actions.createPlace(
          {
            name: stop.name,
            category: poi && poi.category !== 'other' ? poi.category : stop.category,
            location: poi?.location ?? stop.location,
            ...(poi?.googlePlaceId ? { googlePlaceId: poi.googlePlaceId } : {}),
            ...(poi?.osmId ? { osmId: poi.osmId } : {}),
            ...(poi?.address ? { address: poi.address } : {}),
            ...(stop.why ? { notes: stop.why } : {}),
          },
          null,
        ).id
      }
      if (inDay.has(placeId)) continue
      inDay.add(placeId)
      items = insertByTime(items, { id: newId(), placeId, time: stop.time })
      added++
    }
    actions.applyPlanChanges({ [date]: items })
    ui.toast(added ? `נשמרו ${added} עצירות ביום ${dayNumber}` : `כל העצירות כבר בלו״ז של יום ${dayNumber}`)
    onClose()
  }

  return (
    <div className="px-5 pb-6">
      <header className="flex items-center gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">תכנון יום {dayNumber}</h2>
          <p className="text-sm text-muted">
            {formatDay(date, { weekday: 'long', day: 'numeric', month: 'short' })}
            {getCity(trip.dayCities[date]) && ` · ${getCity(trip.dayCities[date])!.name}`}
          </p>
        </div>
      </header>

      {phase.name === 'form' && (
        <div className="mt-5 space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">מה בא לכם?</p>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((interest) => {
                const on = interests.includes(interest)
                return (
                  <button
                    key={interest}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setInterests((current) => (on ? current.filter((x) => x !== interest) : [...current, interest]))}
                    className={clsx(
                      'h-9 rounded-full px-3.5 text-sm font-medium transition-colors',
                      on ? 'bg-accent-fill text-accent-fg' : 'bg-fg/6 text-fg hover:bg-fg/10',
                    )}
                  >
                    {interest}
                  </button>
                )
              })}
            </div>
          </div>
          <TextAreaField
            label="עוד משהו? (לא חובה)"
            value={wishes}
            onChange={(event) => setWishes(event.target.value)}
            placeholder="למשל: רוצים לראות את השקיעה מתצפית, ולאכול וואגיו בערב"
            maxLength={400}
            rows={2}
          />
          <div className="grid grid-cols-2 gap-1 rounded-control bg-fg/6 p-1" role="radiogroup" aria-label="קצב">
            {[
              [false, 'יום מלא'],
              [true, 'יום רגוע'],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                role="radio"
                aria-checked={relaxed === value}
                onClick={() => setRelaxed(value as boolean)}
                className={clsx(
                  'h-9 rounded-inner text-sm font-semibold transition',
                  relaxed === value ? 'bg-card text-fg shadow-sm' : 'text-muted',
                )}
              >
                {label as string}
              </button>
            ))}
          </div>
          <Button size="lg" className="w-full" icon={<Sparkles aria-hidden className="size-4.5" />} onClick={generate}>
            תכננו לי את היום
          </Button>
          <p className="text-center text-xs text-muted">המקומות ששמרתם בעיר מקבלים עדיפות, ופעילויות שכבר בלו״ז נשארות במקומן</p>
          {hasStops && (
            <button
              type="button"
              onClick={() => setRain(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-control bg-sky-500/10 py-3 text-sm font-semibold text-sky-700 dark:text-sky-300"
            >
              <Umbrella aria-hidden className="size-4" />
              יום גשום? התאימו את היום לגשם
            </button>
          )}
        </div>
      )}

      {phase.name === 'loading' && (
        <div className="grid h-64 place-items-center text-center">
          <div>
            <motion.span
              aria-hidden
              className="mx-auto grid size-14 place-items-center rounded-full bg-accent/12 text-accent"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="size-6" />
            </motion.span>
            <p role="status" className="mt-4 font-semibold">
              {phase.step}
            </p>
            <p className="mt-1 text-sm text-muted">זה לוקח כ-20 שניות</p>
          </div>
        </div>
      )}

      {phase.name === 'error' && (
        <div className="py-10 text-center">
          <p className="text-sm text-muted">{FAILURE_TEXT[phase.failure]}</p>
          <Button variant="secondary" className="mt-4" onClick={() => setPhase({ name: 'form' })}>
            חזרה
          </Button>
        </div>
      )}

      {phase.name === 'result' && (
        <div className="mt-4">
          {phase.reply && <p className="rounded-control bg-accent/[0.07] px-4 py-3 text-sm leading-relaxed">{phase.reply}</p>}
          {phase.dietNote && (
            <p
              className={clsx(
                'mt-2 rounded-control px-4 py-2.5 text-sm leading-relaxed font-medium',
                phase.dietNote.tone === 'ok'
                  ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-400/12 text-amber-900 dark:text-amber-300',
              )}
            >
              <bdi>{phase.dietNote.text}</bdi>
            </p>
          )}
          {phase.removed > 0 && (
            <p className="mt-2 flex items-start gap-2 rounded-control bg-amber-400/12 px-4 py-2.5 text-xs leading-relaxed">
              <ShieldCheck aria-hidden className="mt-px size-4 shrink-0 text-amber-700 dark:text-amber-400" />
              {phase.removed === 1 ? 'הסרנו הצעה אחת' : `הסרנו ${phase.removed} הצעות`} שלא מצאנו במפה, כדי שלא תגיעו למקום שלא קיים.
            </p>
          )}
          <ol className="relative mt-4 space-y-3 before:absolute before:inset-y-4 before:start-[2.6rem] before:w-px before:bg-line">
            {phase.stops.map((stop, index) => {
              return (
                <li key={index} className="relative flex items-start gap-3">
                  <span className="w-11 shrink-0 pt-3 text-end text-sm font-semibold tabular-nums" dir="ltr">
                    {stop.time}
                  </span>
                  <div className="surface flex min-w-0 flex-1 items-start gap-3 rounded-control p-3">
                    <CategoryIcon category={stop.category} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{stop.name}</p>
                      {stop.poi && stop.poi.name !== stop.name && (
                        <p className="truncate text-xs text-muted" dir="auto">
                          {stop.poi.name}
                        </p>
                      )}
                      {stop.why && <p className="mt-0.5 text-xs leading-relaxed text-muted">{stop.why}</p>}
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-muted">
                        {stop.savedId && phase.inDay.has(stop.savedId) ? (
                          <>
                            <CalendarCheck aria-hidden className="size-3.5" /> כבר בלו״ז
                          </>
                        ) : stop.savedId ? (
                          <>
                            <BookmarkCheck aria-hidden className="size-3.5 text-accent" /> מהרשימה שלכם
                          </>
                        ) : (
                          <>
                            <MapPin aria-hidden className="size-3.5 text-emerald-600 dark:text-emerald-400" /> נמצא במפה
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
          <div className="mt-5 flex gap-2">
            <Button size="lg" className="flex-1" onClick={() => save(phase.stops)}>
              שמירה ביום {dayNumber}
            </Button>
            <Button size="lg" variant="secondary" icon={<RefreshCw aria-hidden className="size-4" />} onClick={generate}>
              אחר
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setPhase({ name: 'form' })}
            className="mt-3 w-full text-center text-sm font-medium text-muted"
          >
            לשנות את הבקשה
          </button>
        </div>
      )}
    </div>
  )
}
