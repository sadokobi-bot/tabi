import clsx from 'clsx'
import { BedDouble, ChevronDown } from 'lucide-react'
import { actions } from '@/data/actions'
import type { Place } from '@/data/types'

const INHERIT = '__inherit'
const NONE = '__none'

interface StayPickerProps {
  date: string
  /** The entry stored for this night: a place id, '' (no stay) or undefined (inherits). */
  explicit: string | undefined
  /** The stay carried over from the previous nights, if any. */
  inherited: Place | undefined
  places: Place[]
}

/** "Where do we sleep tonight?" for one night. A choice carries on to the next nights until changed. */
export function StayPicker({ date, explicit, inherited, places }: StayPickerProps) {
  const hotels = places.filter((place) => place.category === 'hotel' || place.id === explicit)
  const value = explicit === undefined ? INHERIT : explicit === '' ? NONE : explicit
  const current = explicit === undefined ? inherited : places.find((place) => place.id === explicit)

  return (
    <span className="relative inline-flex max-w-full">
      <BedDouble aria-hidden className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
      <select
        value={value}
        onChange={(event) => {
          const next = event.target.value
          actions.setStay(date, next === INHERIT ? null : next === NONE ? '' : next)
        }}
        aria-label="איפה ישנים בלילה הזה"
        className={clsx(
          // appearance-none: Safari otherwise draws its own grey box and arrow.
          // The open list is drawn by the browser: give its options the app's own colours (they were light text on a light list).
          '[&>option]:bg-bg [&>option]:text-fg',
          'h-9 max-w-[15rem] appearance-none truncate rounded-full border-0 ps-8 pe-7 text-xs font-semibold outline-none focus:ring-2 focus:ring-accent/40',
          current ? 'bg-fg/8 text-fg' : 'bg-transparent text-muted',
        )}
      >
        <option value={INHERIT}>{inherited ? `ממשיכים ב-${inherited.name}` : 'איפה ישנים?'}</option>
        {hotels.map((place) => (
          <option key={place.id} value={place.id}>
            {place.name}
          </option>
        ))}
        {hotels.length === 0 && (
          <option value="" disabled>
            שמרו מלון מהמפה כדי לבחור אותו כאן
          </option>
        )}
        {(inherited || explicit) && <option value={NONE}>ללא לינה בלילה הזה</option>}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
    </span>
  )
}
