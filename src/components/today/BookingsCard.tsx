import clsx from 'clsx'
import { ChevronLeft, Ticket } from 'lucide-react'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { Place } from '@/data/types'
import { bookingLabel, bookingRank, bookingStatus } from '@/lib/booking'
import { ui } from '@/store/ui'

const MAX_ROWS = 4

/** Places still to book, the most pressing first: open now, opening today, then by date. */
export function BookingsCard({ places, today }: { places: Place[]; today: string }) {
  const pending = places
    .flatMap((place) => {
      if (!place.booking) return []
      const status = bookingStatus(place.booking, today)
      return status.kind === 'booked' ? [] : [{ place, status }]
    })
    .sort((a, b) => bookingRank(a.status) - bookingRank(b.status))

  if (pending.length === 0) return null

  return (
    <section aria-label="הזמנות מראש" className="surface rounded-card p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Ticket aria-hidden className="size-4.5 text-accent" />
        הזמנות מראש
        <span className="text-muted tabular-nums">· {pending.length}</span>
      </h2>
      <ul className="-mx-1.5">
        {pending.slice(0, MAX_ROWS).map(({ place, status }) => {
          const urgent = status.kind === 'open' || status.kind === 'today'
          return (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => ui.openPlace(place.id)}
                className="flex w-full items-center gap-3 rounded-control px-1.5 py-2 text-start transition active:scale-[0.98] active:bg-fg/5"
              >
                <CategoryIcon category={place.category} className="size-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{place.name}</span>
                  <span className={clsx('block truncate text-xs', urgent ? 'font-semibold text-accent' : 'text-muted')}>
                    {bookingLabel(status)}
                  </span>
                </span>
                <ChevronLeft aria-hidden className="size-4 shrink-0 text-muted" />
              </button>
            </li>
          )
        })}
      </ul>
      {pending.length > MAX_ROWS && <p className="mt-1 px-0.5 text-xs text-muted">ועוד {pending.length - MAX_ROWS} מקומות</p>}
    </section>
  )
}
