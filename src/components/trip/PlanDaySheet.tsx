import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { BookmarkCheck, CalendarCheck, LoaderCircle, MapPin, RefreshCw, Sparkles } from 'lucide-react'
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
import { useTrip, useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

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

/** Gemini's own coordinates, when the map can't confirm the place. */
const approximate = (stop: PlannedStop): Poi => ({
  key: `ai:${stop.location.lat.toFixed(5)},${stop.location.lng.toFixed(5)}`,
  source: 'osm',
  name: stop.name,
  category: stop.category,
  location: stop.location,
})

type Located = { status: 'locating' } | { status: 'found' | 'approx'; poi: Poi }

type Phase =
  | { name: 'form' }
  | { name: 'loading' }
  | { name: 'result'; reply: string; stops: PlannedStop[]; inDay: Set<string> }
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
  const [located, setLocated] = useState<Record<number, Located>>({})
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const dayNumber = tripDates(trip).indexOf(date) + 1
  const hotelId = stayFor(trip.stays, addDays(date, -1))

  const generate = async () => {
    abortRef.current?.abort()
    setPhase({ name: 'loading' })
    setLocated({})
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

    try {
      const answer = await planDayWithAi({
        area: city?.en ?? '',
        dateLabel: new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
        wishes: [interests.join(', '), wishes].filter(Boolean).join('. '),
        relaxed,
        saved: saved.slice(0, 60).map(({ id, name, category }) => ({ id, name, category })),
        fixed,
        elsewhere: elsewhere.slice(0, 40).map((place) => place.name),
        ...(hotel ? { hotel: hotel.name } : {}),
      })
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
      if (unique.length === 0) {
        setPhase({ name: 'error', failure: 'other' })
        return
      }
      setPhase({ name: 'result', reply: answer.reply, stops: unique, inDay })
      locate(unique)
    } catch (error) {
      console.error('[plan] failed', error)
      setPhase({ name: 'error', failure: failureOf(error) })
    }
  }

  /** Pins the new suggestions to real map entries, one by one (saved places are already exact). */
  const locate = async (stops: PlannedStop[]) => {
    const controller = new AbortController()
    abortRef.current = controller
    setLocated(Object.fromEntries(stops.flatMap((stop, index) => (stop.savedId ? [] : [[index, { status: 'locating' }]]))))
    for (const [index, stop] of stops.entries()) {
      if (stop.savedId) continue
      try {
        // A map lookup that hangs (offline, maps not loaded) falls back to Gemini's approximate position.
        const poi = await Promise.race([
          resolveOnMap(stop, provider, controller.signal),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATE_TIMEOUT_MS)),
        ])
        if (controller.signal.aborted) return
        setLocated((current) => ({
          ...current,
          [index]: poi && !poi.key.startsWith('ai:') ? { status: 'found', poi } : { status: 'approx', poi: approximate(stop) },
        }))
      } catch {
        if (controller.signal.aborted) return
        setLocated((current) => ({ ...current, [index]: { status: 'approx', poi: approximate(stop) } }))
      }
    }
  }

  const stillLocating = Object.values(located).some((entry) => entry.status === 'locating')

  const save = (stops: PlannedStop[]) => {
    const { plan } = useTripStore.getState()
    let items: ItineraryItem[] = [...(plan[date] ?? [])]
    const inDay = new Set(items.map((item) => item.placeId))
    let added = 0
    for (const [index, stop] of stops.entries()) {
      let placeId = stop.savedId
      if (!placeId) {
        const entry = located[index]
        const poi = entry && entry.status !== 'locating' ? entry.poi : undefined
        placeId = actions.createPlace(
          {
            name: stop.name,
            category: poi && poi.category !== 'other' ? poi.category : stop.category,
            location: poi?.location ?? stop.location,
            ...(poi?.googlePlaceId ? { googlePlaceId: poi.googlePlaceId } : {}),
            ...(poi?.osmId ? { osmId: poi.osmId } : {}),
            ...(poi?.address && entry?.status === 'found' ? { address: poi.address } : {}),
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
              מתכננים לכם יום…
            </p>
            <p className="mt-1 text-sm text-muted">זה לוקח כ-15 שניות</p>
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
          <ol className="relative mt-4 space-y-3 before:absolute before:inset-y-4 before:start-[2.6rem] before:w-px before:bg-line">
            {phase.stops.map((stop, index) => {
              const entry = located[index]
              return (
                <li key={index} className="relative flex items-start gap-3">
                  <span className="w-11 shrink-0 pt-3 text-end text-sm font-semibold tabular-nums" dir="ltr">
                    {stop.time}
                  </span>
                  <div className="surface flex min-w-0 flex-1 items-start gap-3 rounded-control p-3">
                    <CategoryIcon category={stop.category} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{stop.name}</p>
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
                        ) : entry?.status === 'locating' ? (
                          <>
                            <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> מאתרים במפה…
                          </>
                        ) : entry?.status === 'approx' ? (
                          <>
                            <MapPin aria-hidden className="size-3.5" /> מיקום משוער
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
            <Button size="lg" className="flex-1" disabled={stillLocating} loading={stillLocating} onClick={() => save(phase.stops)}>
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
