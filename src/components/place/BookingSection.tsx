import { useState } from 'react'
import clsx from 'clsx'
import { CircleCheck, Pencil, Ticket, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { actions } from '@/data/actions'
import type { Place } from '@/data/types'
import { bookingLabel, bookingStatus } from '@/lib/booking'
import { isoDateInTz } from '@/lib/dates'

/**
 * "Book ahead" reminder for a saved place: many Japanese spots sell out weeks before
 * (the Ghibli Museum, teamLab, famous restaurants). Optional date when booking opens;
 * the Today screen counts down to it until it's marked as booked.
 */
export function BookingSection({ place }: { place: Place }) {
  const booking = place.booking
  const [editing, setEditing] = useState(false)
  const [opensOn, setOpensOn] = useState(booking?.opensOn ?? '')

  const save = () => {
    actions.updatePlace(place, { booking: { ...(opensOn ? { opensOn } : {}), booked: false } }, 'נוספה תזכורת להזמנה')
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="surface mt-4 rounded-control p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Ticket aria-hidden className="size-4.5 text-accent" />
          צריך להזמין מראש
        </p>
        <div className="mt-3">
          <TextField
            label="ההזמנות נפתחות ב־ (לא חובה)"
            type="date"
            value={opensOn}
            onChange={(event) => setOpensOn(event.target.value)}
            hint="למשל: מוזיאון ג׳יבלי פותח כרטיסים ב-10 לכל חודש, לחודש הבא"
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" onClick={save}>
            שמירה
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            ביטול
          </Button>
        </div>
      </div>
    )
  }

  if (!booking) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-4 flex w-full items-center gap-2 rounded-control border border-dashed border-line px-4 py-3 text-sm text-muted transition hover:bg-fg/[0.03]"
      >
        <Ticket aria-hidden className="size-4.5 shrink-0" />
        צריך להזמין מראש? הוסיפו תזכורת
      </button>
    )
  }

  const status = bookingStatus(booking, isoDateInTz(new Date()))
  const booked = status.kind === 'booked'
  const urgent = status.kind === 'today' || status.kind === 'open'

  return (
    <div
      className={clsx(
        'mt-4 flex items-center gap-3 rounded-control px-4 py-3',
        booked ? 'bg-emerald-500/10' : urgent ? 'bg-accent/10' : 'bg-fg/5',
      )}
    >
      {booked ? (
        <CircleCheck aria-hidden className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <Ticket aria-hidden className={clsx('size-5 shrink-0', urgent ? 'text-accent' : 'text-muted')} />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">הזמנה מראש</p>
        <p className={clsx('text-sm font-semibold', booked && 'text-emerald-700 dark:text-emerald-400', urgent && 'text-accent')}>
          {bookingLabel(status)}
        </p>
      </div>
      {booked ? (
        <button
          type="button"
          onClick={() => actions.updatePlace(place, { booking: { ...booking, booked: false } })}
          className="shrink-0 rounded-inner px-2 py-1.5 text-xs font-medium text-muted hover:bg-fg/6"
        >
          ביטול סימון
        </button>
      ) : (
        <>
          <Button
            className="shrink-0"
            onClick={() => actions.updatePlace(place, { booking: { ...booking, booked: true } }, 'מעולה, סומן כהוזמן')}
          >
            הוזמן
          </Button>
          <button
            type="button"
            aria-label="עריכת תאריך ההזמנה"
            onClick={() => {
              setOpensOn(booking.opensOn ?? '')
              setEditing(true)
            }}
            className="tap-target relative grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-fg/8"
          >
            <Pencil aria-hidden className="size-4" />
          </button>
        </>
      )}
      <button
        type="button"
        aria-label="הסרת התזכורת"
        onClick={() => actions.updatePlace(place, { booking: undefined })}
        className="tap-target relative grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-fg/8"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  )
}
