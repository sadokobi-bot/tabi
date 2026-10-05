import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { actions } from '@/data/actions'
import { getCity } from '@/data/cities'
import { formatDay, tripDates, tripTimeline } from '@/lib/dates'
import { usePlace, useTrip, useTripStore } from '@/store/trip'

/** Pick a day (and optionally a time) to add a saved place to the itinerary. */
export function ScheduleForm({ placeId, onDone }: { placeId: string; onDone: () => void }) {
  const trip = useTrip()
  const plan = useTripStore((state) => state.plan)
  const place = usePlace(placeId)
  const dates = useMemo(() => tripDates(trip), [trip])
  const [date, setDate] = useState(() => tripTimeline(trip, new Date()).focusDate)
  const [time, setTime] = useState('')
  const dayNumber = dates.indexOf(date) + 1

  const submit = () => {
    actions.addToDay(placeId, date, time || undefined, `נוסף ליום ${dayNumber}`)
    onDone()
  }

  return (
    <div className="px-5 pt-2 pb-4">
      <h2 className="text-xl font-bold">שיבוץ ביום</h2>
      {place && <p className="mt-1 text-sm text-muted">{place.name}</p>}

      <div className="mt-4">
        <TextField label="שעה (לא חובה)" type="time" value={time} onChange={(event) => setTime(event.target.value)} dir="ltr" />
      </div>

      <p className="mt-5 mb-2 text-sm font-medium">באיזה יום?</p>
      <div role="radiogroup" aria-label="יום בטיול" className="max-h-[38dvh] space-y-1.5 overflow-y-auto rounded-2xl">
        {dates.map((iso, index) => {
          const active = iso === date
          const city = getCity(trip.dayCities[iso])
          const count = plan[iso]?.length ?? 0
          return (
            <button
              key={iso}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setDate(iso)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-2xl border px-4 py-2.5 text-start transition',
                active ? 'border-accent bg-accent/10' : 'border-line bg-card/60 hover:bg-fg/5',
              )}
            >
              <span className={clsx('w-12 shrink-0 text-sm font-bold', active && 'text-accent')}>יום {index + 1}</span>
              <span className="flex-1 text-sm">
                {formatDay(iso)}
                {city && <span className="text-muted"> · {city.name}</span>}
              </span>
              {count > 0 && <span className="text-xs text-muted">{count} פעילויות</span>}
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex gap-3">
        <Button size="lg" className="flex-1" onClick={submit}>
          הוספה ליום {dayNumber}
        </Button>
        <Button variant="secondary" size="lg" onClick={onDone}>
          ביטול
        </Button>
      </div>
    </div>
  )
}
