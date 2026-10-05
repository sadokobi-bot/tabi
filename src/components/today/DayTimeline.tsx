import clsx from 'clsx'
import { MapPinPlus, Moon, Sun, Sunrise, Clock4 } from 'lucide-react'
import { useNavigate } from 'react-router'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { Button } from '@/components/ui/Button'
import type { ItineraryItem, Place } from '@/data/types'
import { parseHm } from '@/lib/dates'
import { ui } from '@/store/ui'

interface DayTimelineProps {
  items: ItineraryItem[]
  placesById: Record<string, Place>
  /** Minutes since midnight in Japan when showing today; null for other days. */
  nowMinutes: number | null
  nextItemId: string | null
}

const SECTIONS = [
  { id: 'morning', label: 'בוקר', icon: Sunrise, test: (m: number | null) => m != null && m < 12 * 60 },
  { id: 'noon', label: 'צהריים', icon: Sun, test: (m: number | null) => m != null && m >= 12 * 60 && m < 17 * 60 },
  { id: 'evening', label: 'ערב', icon: Moon, test: (m: number | null) => m != null && m >= 17 * 60 },
  { id: 'anytime', label: 'בלי שעה', icon: Clock4, test: (m: number | null) => m == null },
] as const

/** Vertical timeline of the day, grouped into morning / afternoon / evening. */
export function DayTimeline({ items, placesById, nowMinutes, nextItemId }: DayTimelineProps) {
  const navigate = useNavigate()

  if (items.length === 0) {
    return (
      <div className="surface rounded-3xl p-6 text-center">
        <p className="font-semibold">עוד אין תוכנית ליום הזה</p>
        <p className="mt-1 text-sm text-muted">מוסיפים מקומות מהמפה ומשבצים אותם בימים</p>
        <Button className="mt-4" icon={<MapPinPlus aria-hidden className="size-4.5" />} onClick={() => navigate('/map')}>
          למפה
        </Button>
      </div>
    )
  }

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
                return (
                  <li key={item.id} className={clsx('relative flex items-center gap-3', past && 'opacity-55')}>
                    <span className="w-11 shrink-0 text-end text-sm font-semibold tabular-nums" dir="ltr">
                      {item.time ?? '–'}
                    </span>
                    <span
                      aria-hidden
                      className={clsx(
                        'relative z-[1] size-3 shrink-0 rounded-full border-2 border-bg',
                        isNext ? 'bg-accent ring-4 ring-accent/20' : past ? 'bg-fg/25' : 'bg-fg/45',
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => ui.openPlace(place.id)}
                      className={clsx(
                        'surface flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-3 text-start transition active:scale-[0.98]',
                        isNext && 'ring-2 ring-accent/50',
                      )}
                    >
                      <CategoryIcon category={place.category} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{place.name}</span>
                        {(item.note || place.notes) && (
                          <span className="block truncate text-xs text-muted">{item.note || place.notes}</span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}
    </div>
  )
}
