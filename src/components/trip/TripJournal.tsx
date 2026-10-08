import { NotebookPen } from 'lucide-react'
import { Stars } from '@/components/place/VisitSection'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import type { Place, Trip } from '@/data/types'
import { formatDay, tripDates } from '@/lib/dates'
import { ui } from '@/store/ui'

/** Everything we've marked "we were here", day by day, with ratings and notes: the trip as it happened. */
export function TripJournal({ trip, places }: { trip: Trip; places: Place[] }) {
  const visited = places.filter((place) => place.visit)

  if (visited.length === 0) {
    return (
      <div className="surface rounded-card p-6 text-center">
        <NotebookPen aria-hidden className="mx-auto size-8 text-muted" />
        <p className="mt-3 font-semibold">היומן עוד ריק</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          פותחים מקום שביקרתם בו ולוחצים ״היינו פה״. כאן יצטבר כל הטיול, יום אחרי יום.
        </p>
      </div>
    )
  }

  const dates = tripDates(trip)
  const byDay = new Map<string, Place[]>()
  for (const place of visited) byDay.set(place.visit!.on, [...(byDay.get(place.visit!.on) ?? []), place])
  const days = [...byDay.keys()].sort()

  const rated = visited.flatMap((place) => (place.visit!.rating ? [place.visit!.rating] : []))
  const average = rated.length ? rated.reduce((sum, value) => sum + value, 0) / rated.length : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat value={visited.length} label={visited.length === 1 ? 'מקום' : 'מקומות'} />
        <Stat value={days.length} label={days.length === 1 ? 'יום' : 'ימים'} />
        <Stat value={average ? `${average.toFixed(1)}★` : '-'} label="דירוג ממוצע" />
      </div>

      {days.map((day) => {
        const index = dates.indexOf(day)
        return (
          <section key={day}>
            <h3 className="mb-2 flex items-baseline justify-between px-1">
              <span className="font-bold">{index >= 0 ? `יום ${index + 1}` : formatDay(day, { day: 'numeric', month: 'short' })}</span>
              <span className="text-xs text-muted">{formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </h3>
            <ul className="space-y-2">
              {byDay.get(day)!.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => ui.openPlace(place.id)}
                    className="surface flex w-full items-start gap-3 rounded-control p-3 text-start transition active:scale-[0.98]"
                  >
                    <CategoryIcon category={place.category} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{place.name}</span>
                      {place.visit!.rating ? <Stars value={place.visit!.rating} className="mt-0.5" /> : null}
                      {place.visit!.note && (
                        <span className="mt-1 block text-sm leading-relaxed whitespace-pre-line text-muted">{place.visit!.note}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="surface rounded-control px-2 py-3">
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}
