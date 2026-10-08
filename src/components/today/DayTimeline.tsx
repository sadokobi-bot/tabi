import { Fragment } from 'react'
import clsx from 'clsx'
import { CircleCheck, MapPinPlus, Moon, Sparkles, Sun, Sunrise, Clock4 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { ClosedNote } from '@/components/place/ClosedNote'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { Button } from '@/components/ui/Button'
import type { ItineraryItem, Place } from '@/data/types'
import { parseHm } from '@/lib/dates'
import { ui } from '@/store/ui'
import { TravelLeg } from './TravelLeg'

interface DayTimelineProps {
  /** The day shown (YYYY-MM-DD), for opening-hours warnings. */
  date: string
  items: ItineraryItem[]
  placesById: Record<string, Place>
  /** Minutes since midnight in Japan when showing today; null for other days. */
  nowMinutes: number | null
  nextItemId: string | null
  /** Offered on an empty day: build it with the AI planner. */
  onPlan?: () => void
}

const SECTIONS = [
  { id: 'morning', label: 'בוקר', icon: Sunrise, test: (m: number | null) => m != null && m < 12 * 60 },
  { id: 'noon', label: 'צהריים', icon: Sun, test: (m: number | null) => m != null && m >= 12 * 60 && m < 17 * 60 },
  { id: 'evening', label: 'ערב', icon: Moon, test: (m: number | null) => m != null && m >= 17 * 60 },
  { id: 'anytime', label: 'בלי שעה', icon: Clock4, test: (m: number | null) => m == null },
] as const

/** Vertical timeline of the day, grouped into morning / afternoon / evening. */
export function DayTimeline({ date, items, placesById, nowMinutes, nextItemId, onPlan }: DayTimelineProps) {
  const navigate = useNavigate()

  if (items.length === 0) {
    return (
      <div className="surface rounded-card p-6 text-center">
        <p className="font-semibold">עוד אין תוכנית ליום הזה</p>
        <p className="mt-1 text-sm text-muted">מוסיפים מקומות מהמפה ומשבצים אותם בימים</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {onPlan && (
            <Button icon={<Sparkles aria-hidden className="size-4.5" />} onClick={onPlan}>
              תכנן לי את היום
            </Button>
          )}
          <Button
            variant={onPlan ? 'secondary' : 'primary'}
            icon={<MapPinPlus aria-hidden className="size-4.5" />}
            onClick={() => navigate('/map')}
          >
            למפה
          </Button>
        </div>
      </div>
    )
  }

  // "Now" line: drawn before the first activity that hasn't started yet (or after the last one).
  const timed = nowMinutes == null ? [] : items.filter((item) => parseHm(item.time) != null)
  const upcoming = timed.find((item) => (parseHm(item.time) ?? 0) > (nowMinutes ?? 0))
  const nowBeforeId = upcoming?.id ?? null
  const nowAfterId = !upcoming && timed.length ? timed[timed.length - 1]!.id : null
  const nowLine = nowMinutes != null && <NowLine minutes={nowMinutes} />

  return (
    <div className="space-y-6">
      {SECTIONS.map((section) => {
        const sectionItems = items.filter((item) => section.test(parseHm(item.time)))
        if (sectionItems.length === 0) return null
        const SectionIcon = section.icon
        return (
          <section key={section.id} aria-label={section.label}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted">
              <SectionIcon aria-hidden className="size-4" />
              {section.label}
            </h3>
            <ol className="relative space-y-3 before:absolute before:inset-y-3 before:start-[3.15rem] before:w-px before:bg-line">
              {sectionItems.map((item) => {
                const place = placesById[item.placeId]
                if (!place) return null
                const minutes = parseHm(item.time)
                const past = nowMinutes != null && minutes != null && minutes + 60 < nowMinutes
                const isNext = item.id === nextItemId
                // The ride from the previous stop of the day (which may sit in the section before).
                const previous = items[items.indexOf(item) - 1]
                const previousPlace = previous && placesById[previous.placeId]
                return (
                  <Fragment key={item.id}>
                    {item.id === nowBeforeId && nowLine}
                    {previous && previousPlace && <TravelLeg from={{ item: previous, place: previousPlace }} to={{ item, place }} />}
                    <li className={clsx('relative flex items-center gap-3', past && 'opacity-55')}>
                      <span className="w-11 shrink-0 text-end text-sm font-semibold tabular-nums" dir="ltr">
                        {item.time ?? '-'}
                      </span>
                      <span
                        aria-hidden
                        className={clsx(
                          'relative z-[1] size-3 shrink-0 rounded-full border-2 border-bg',
                          isNext ? 'bg-accent-fill ring-4 ring-accent/20' : past ? 'bg-fg/25' : 'bg-fg/45',
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => ui.openPlace(place.id)}
                        className={clsx(
                          'surface flex min-w-0 flex-1 items-center gap-3 rounded-control p-3 text-start transition active:scale-[0.98]',
                          isNext && 'ring-2 ring-accent/50',
                        )}
                      >
                        <CategoryIcon category={place.category} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-semibold">{place.name}</span>
                            {place.visit && (
                              <CircleCheck aria-label="היינו פה" className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            )}
                          </span>
                          {(item.note || place.notes) && (
                            <span className="block truncate text-xs text-muted">{item.note || place.notes}</span>
                          )}
                          <ClosedNote
                            place={place}
                            date={date}
                            time={item.time}
                            fetch
                            nowMinutes={past ? null : nowMinutes}
                            className="mt-0.5"
                          />
                        </span>
                      </button>
                    </li>
                    {item.id === nowAfterId && nowLine}
                  </Fragment>
                )
              })}
            </ol>
          </section>
        )
      })}
    </div>
  )
}

/** A red "you are here" rule across the timeline. */
function NowLine({ minutes }: { minutes: number }) {
  const label = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  return (
    <li aria-label={`עכשיו ${label}`} className="relative flex items-center gap-3">
      <span className="w-11 shrink-0 text-end text-xs font-bold text-accent tabular-nums" dir="ltr">
        {label}
      </span>
      <span aria-hidden className="relative z-[1] size-3 shrink-0 rounded-full bg-accent-fill ring-4 ring-accent/20" />
      <span aria-hidden className="h-0.5 flex-1 rounded-full bg-linear-to-l from-accent to-accent/0" />
    </li>
  )
}
