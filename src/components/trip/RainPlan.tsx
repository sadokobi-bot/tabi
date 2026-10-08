import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { ArrowDown, BookmarkCheck, Check, CloudRain, LoaderCircle, MapPin, RefreshCw, Umbrella } from 'lucide-react'
import { motion } from 'motion/react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { actions } from '@/data/actions'
import { getCity, nearestCity } from '@/data/cities'
import { sortedDay } from '@/data/planOps'
import { stayFor } from '@/data/stays'
import type { ItineraryItem, LatLng, Place } from '@/data/types'
import { FAILURE_TEXT, failureOf, rainPlanWithAi, resolveOnMap, type AssistantFailure, type RainSwap } from '@/lib/assistant'
import { addDays, tripDates } from '@/lib/dates'
import { fetchDayForecast, rainWindows } from '@/lib/weather'
import type { Poi } from '@/maps/poi'
import { usePoiProvider } from '@/maps/usePoiProvider'
import { useTrip, useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

const LOCATE_TIMEOUT_MS = 10_000
const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`

type Forecast = { status: 'loading' } | { status: 'none' } | { status: 'ok'; windows: [number, number][] }

/** The day's rain hours, where the day happens (its city, else its first stop or last night's hotel). */
function useDayRain(date: string, where: LatLng | null): Forecast {
  const [forecast, setForecast] = useState<Forecast>({ status: 'loading' })
  const lat = where?.lat
  const lng = where?.lng
  useEffect(() => {
    if (lat == null || lng == null) {
      setForecast({ status: 'none' })
      return
    }
    const controller = new AbortController()
    fetchDayForecast({ lat, lng }, date, controller.signal).then(
      (data) => setForecast(data ? { status: 'ok', windows: rainWindows(data) } : { status: 'none' }),
      () => !controller.signal.aborted && setForecast({ status: 'none' }),
    )
    return () => controller.abort()
  }, [date, lat, lng])
  return forecast
}

type Located = { status: 'locating' } | { status: 'found' | 'approx'; poi: Poi }

type Phase =
  | { name: 'intro' }
  | { name: 'loading' }
  | { name: 'result'; reply: string; swaps: RainSwap[] }
  | { name: 'error'; failure: AssistantFailure }

export function RainPlanSheet({ date, onClose }: { date: string | null; onClose: () => void }) {
  return (
    <BottomSheet open={date !== null} onClose={onClose} label="תוכנית ליום גשום">
      {date && <RainPlan key={date} date={date} onDone={onClose} />}
    </BottomSheet>
  )
}

/**
 * "A rainy day": Gemini spots the day's outdoor stops at rainy hours and suggests an indoor
 * alternative next to each, at the same time. Each swap can be kept or skipped; the replaced places
 * stay saved in the trip.
 */
export function RainPlan({ date, onDone }: { date: string; onDone: () => void }) {
  const trip = useTrip()
  const provider = usePoiProvider()
  const plan = useTripStore((state) => state.plan)
  const placesById = useTripStore((state) => state.placesById)
  const [phase, setPhase] = useState<Phase>({ name: 'intro' })
  const [located, setLocated] = useState<Record<number, Located>>({})
  const [skipped, setSkipped] = useState<Set<number>>(new Set())
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  const dayNumber = tripDates(trip).indexOf(date) + 1
  const items = sortedDay(plan[date]).filter((item) => placesById[item.placeId])
  const hotelId = stayFor(trip.stays, addDays(date, -1))
  const hotel = hotelId ? placesById[hotelId] : undefined
  const city = getCity(trip.dayCities[date]) ?? (hotel ? nearestCity(hotel.location) : undefined)
  const where = city?.location ?? (items[0] ? placesById[items[0].placeId]!.location : (hotel?.location ?? null))
  const forecast = useDayRain(date, where)
  const ranges = forecast.status === 'ok' ? forecast.windows.map(([from, to]) => `${hourLabel(from)}–${hourLabel(to)}`) : []

  const generate = async () => {
    abortRef.current?.abort()
    setPhase({ name: 'loading' })
    setLocated({})
    setSkipped(new Set())
    const { places } = useTripStore.getState()
    const scheduled = new Set(Object.values(plan).flatMap((dayItems) => dayItems.map((item) => item.placeId)))
    const inCity = (place: Place) => !city || nearestCity(place.location)?.id === city.id
    try {
      const answer = await rainPlanWithAi({
        area: city?.en ?? '',
        dateLabel: new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        }),
        rain: ranges.length ? ranges.join(', ') : 'most of the day (plan a full rainy-day backup)',
        stops: items.map((item) => {
          const place = placesById[item.placeId]!
          return { id: item.id, ...(item.time ? { time: item.time } : {}), name: place.name, category: place.category }
        }),
        saved: places
          .filter((place) => !scheduled.has(place.id) && place.category !== 'hotel' && inCity(place))
          .slice(0, 60)
          .map(({ id, name, category }) => ({ id, name, category })),
        elsewhere: places
          .filter((place) => scheduled.has(place.id) && !items.some((item) => item.placeId === place.id) && inCity(place))
          .slice(0, 40)
          .map((place) => place.name),
        ...(hotel ? { hotel: hotel.name } : {}),
      })
      setPhase({ name: 'result', reply: answer.reply, swaps: answer.swaps })
      void locate(answer.swaps)
    } catch (error) {
      console.error('[rain] failed', error)
      setPhase({ name: 'error', failure: failureOf(error) })
    }
  }

  /** Pins each new alternative to a real map entry (saved places are exact already). */
  const locate = async (swaps: RainSwap[]) => {
    const controller = new AbortController()
    abortRef.current = controller
    setLocated(Object.fromEntries(swaps.flatMap((swap, index) => (swap.savedId ? [] : [[index, { status: 'locating' }]]))))
    for (const [index, swap] of swaps.entries()) {
      if (swap.savedId) continue
      const approx: Poi = { key: `ai:${index}`, source: 'osm', name: swap.name, category: swap.category, location: swap.location }
      try {
        const poi = await Promise.race([
          resolveOnMap(swap, provider, controller.signal),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATE_TIMEOUT_MS)),
        ])
        if (controller.signal.aborted) return
        setLocated((current) => ({
          ...current,
          [index]: poi && !poi.key.startsWith('ai:') ? { status: 'found', poi } : { status: 'approx', poi: approx },
        }))
      } catch {
        if (controller.signal.aborted) return
        setLocated((current) => ({ ...current, [index]: { status: 'approx', poi: approx } }))
      }
    }
  }

  const apply = (swaps: RainSwap[]) => {
    const chosen = swaps.flatMap((swap, index) => (skipped.has(index) ? [] : [{ swap, index }]))
    let dayItems: ItineraryItem[] = [...(useTripStore.getState().plan[date] ?? [])]
    for (const { swap, index } of chosen) {
      let placeId = swap.savedId
      if (!placeId) {
        const entry = located[index]
        const poi = entry && entry.status !== 'locating' ? entry.poi : undefined
        placeId = actions.createPlace(
          {
            name: swap.name,
            category: poi && poi.category !== 'other' ? poi.category : swap.category,
            location: poi?.location ?? swap.location,
            ...(poi?.googlePlaceId ? { googlePlaceId: poi.googlePlaceId } : {}),
            ...(poi?.osmId ? { osmId: poi.osmId } : {}),
            ...(poi?.address && entry?.status === 'found' ? { address: poi.address } : {}),
            ...(swap.why ? { notes: swap.why } : {}),
          },
          null,
        ).id
      }
      const newPlaceId = placeId
      // Same slot in the day, new place; the note belonged to the old one.
      dayItems = dayItems.map((item) =>
        item.id === swap.replaceId
          ? { id: item.id, placeId: newPlaceId, ...((item.time ?? swap.time) ? { time: item.time ?? swap.time } : {}) }
          : item,
      )
    }
    actions.applyPlanChanges({ [date]: dayItems })
    ui.toast(
      chosen.length
        ? `${chosen.length === 1 ? 'עצירה אחת הוחלפה' : `${chosen.length} עצירות הוחלפו`}. המקומות הקודמים נשארו ברשימה שלכם`
        : 'היום נשאר כמו שהוא',
    )
    onDone()
  }

  const stillLocating = Object.values(located).some((entry) => entry.status === 'locating')

  return (
    <div className="px-5 pb-6">
      <header className="flex items-center gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-control bg-sky-500/12 text-sky-600 dark:text-sky-400">
          <Umbrella className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight">תוכנית ליום גשום</h2>
          <p className="text-sm text-muted">
            יום {dayNumber}
            {city && ` · ${city.name}`}
          </p>
        </div>
      </header>

      {phase.name === 'intro' && (
        <div className="mt-5">
          <p className="flex gap-2.5 rounded-control bg-sky-500/10 px-4 py-3 text-sm leading-relaxed">
            <CloudRain aria-hidden className="mt-0.5 size-4.5 shrink-0 text-sky-600 dark:text-sky-400" />
            {forecast.status === 'loading'
              ? 'בודקים את התחזית…'
              : forecast.status === 'none'
                ? 'אין עדיין תחזית לשעות של היום הזה (יש רק כשבועיים קדימה). אפשר בכל זאת להכין תוכנית גיבוי, למקרה שירד גשם.'
                : ranges.length
                  ? `צפוי גשם ${ranges.join(', ')}. נמצא חלופות מקורות לעצירות שבחוץ, ליד אותו מקום ובאותה שעה.`
                  : 'לפי התחזית לא צפוי גשם ביום הזה. אפשר בכל זאת להכין תוכנית גיבוי.'}
          </p>
          {items.length === 0 ? (
            <p className="mt-4 text-center text-sm text-muted">אין עדיין עצירות ביום הזה, אז אין מה להחליף</p>
          ) : (
            <>
              <Button
                size="lg"
                className="mt-4 w-full"
                icon={<Umbrella aria-hidden className="size-4.5" />}
                disabled={forecast.status === 'loading'}
                onClick={generate}
              >
                {ranges.length ? 'התאימו את היום לגשם' : 'הכינו תוכנית גיבוי לגשם'}
              </Button>
              <p className="mt-2 text-center text-xs text-muted">עצירות שבתוך מבנה נשארות כמו שהן. אתם בוחרים מה להחליף</p>
            </>
          )}
        </div>
      )}

      {phase.name === 'loading' && (
        <div className="grid h-56 place-items-center text-center">
          <div>
            <motion.span
              aria-hidden
              className="mx-auto grid size-14 place-items-center rounded-full bg-sky-500/12 text-sky-600 dark:text-sky-400"
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Umbrella className="size-6" />
            </motion.span>
            <p role="status" className="mt-4 font-semibold">
              מחפשים חלופות יבשות…
            </p>
            <p className="mt-1 text-sm text-muted">זה לוקח כ-15 שניות</p>
          </div>
        </div>
      )}

      {phase.name === 'error' && (
        <div className="py-10 text-center">
          <p className="text-sm text-muted">{FAILURE_TEXT[phase.failure]}</p>
          <Button variant="secondary" className="mt-4" onClick={() => setPhase({ name: 'intro' })}>
            חזרה
          </Button>
        </div>
      )}

      {phase.name === 'result' && (
        <div className="mt-4">
          {phase.reply && <p className="rounded-control bg-sky-500/[0.08] px-4 py-3 text-sm leading-relaxed">{phase.reply}</p>}
          {phase.swaps.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">כל העצירות של היום מקורות, אז הגשם לא משנה כלום 🙂</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {phase.swaps.map((swap, index) => {
                const original = items.find((item) => item.id === swap.replaceId)
                const originalPlace = original ? placesById[original.placeId] : undefined
                const entry = located[index]
                const on = !skipped.has(index)
                return (
                  <li key={index} className={clsx('surface rounded-control p-3 transition-opacity', !on && 'opacity-55')}>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="tabular-nums" dir="ltr">
                        {original?.time ?? swap.time}
                      </span>
                      <span className="min-w-0 truncate line-through">{originalPlace?.name}</span>
                      <span className="shrink-0">· בחוץ</span>
                    </div>
                    <ArrowDown aria-hidden className="my-1 ms-1 size-3.5 text-muted" />
                    <div className="flex items-start gap-3">
                      <CategoryIcon category={swap.category} className="size-9" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{swap.name}</p>
                        {swap.why && <p className="mt-0.5 text-xs leading-relaxed text-muted">{swap.why}</p>}
                        <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-muted">
                          {swap.savedId ? (
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
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`להחליף ל${swap.name}`}
                        onClick={() =>
                          setSkipped((current) => {
                            const next = new Set(current)
                            if (on) next.add(index)
                            else next.delete(index)
                            return next
                          })
                        }
                        className={clsx(
                          'grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors',
                          on ? 'border-transparent bg-accent-fill text-accent-fg' : 'border-line text-transparent',
                        )}
                      >
                        <Check aria-hidden className="size-4.5" strokeWidth={3} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="mt-5 flex gap-2">
            {phase.swaps.length > 0 && (
              <Button size="lg" className="flex-1" disabled={stillLocating} loading={stillLocating} onClick={() => apply(phase.swaps)}>
                {phase.swaps.length - skipped.size > 0 ? `להחליף (${phase.swaps.length - skipped.size})` : 'להשאיר כמו שהוא'}
              </Button>
            )}
            <Button size="lg" variant="secondary" icon={<RefreshCw aria-hidden className="size-4" />} onClick={generate}>
              אחר
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
