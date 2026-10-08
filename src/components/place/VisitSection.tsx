import { useState } from 'react'
import clsx from 'clsx'
import { CircleCheck, Pencil, Star, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/TextField'
import { actions } from '@/data/actions'
import type { Place } from '@/data/types'
import { formatDay, isoDateInTz } from '@/lib/dates'
import { scheduleOf, useTripStore } from '@/store/trip'

/** Read-only stars, e.g. in the journal. */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={clsx('inline-flex gap-0.5', className)} aria-label={`${value} מתוך 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={clsx('size-3.5', n <= value ? 'fill-amber-400 text-amber-400' : 'text-fg/20')} />
      ))}
    </span>
  )
}

/** "We were here": a date, an optional 1-5 rating and a note, collected into the trip journal. */
export function VisitSection({ place }: { place: Place }) {
  const plan = useTripStore((state) => state.plan)
  const visit = place.visit
  const [editing, setEditing] = useState(false)
  const [on, setOn] = useState('')
  const [rating, setRating] = useState(0)
  const [note, setNote] = useState('')

  const startEditing = () => {
    const today = isoDateInTz(new Date())
    // The day it was planned for, if that day has come; otherwise today.
    const planned = scheduleOf(plan, place.id)
      .map(({ date }) => date)
      .filter((date) => date <= today)
      .pop()
    setOn(visit?.on ?? planned ?? today)
    setRating(visit?.rating ?? 0)
    setNote(visit?.note ?? '')
    setEditing(true)
  }

  const save = () => {
    const text = note.trim()
    actions.updatePlace(
      place,
      { visit: { on: on || isoDateInTz(new Date()), ...(rating ? { rating } : {}), ...(text ? { note: text } : {}) } },
      'נשמר ביומן הטיול',
    )
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="surface mt-4 space-y-3 rounded-control p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <CircleCheck aria-hidden className="size-4.5 text-emerald-600 dark:text-emerald-400" />
          היינו פה
        </p>
        <div>
          <p className="mb-1.5 text-sm font-medium">איך היה?</p>
          <div role="radiogroup" aria-label="דירוג" className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} כוכבים`}
                onClick={() => setRating(rating === n ? 0 : n)}
                className="tap-target relative grid size-10 place-items-center rounded-full transition active:scale-90"
              >
                <Star className={clsx('size-7', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-fg/25')} />
              </button>
            ))}
          </div>
        </div>
        <TextAreaField
          label="מה נזכור מפה? (לא חובה)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          rows={2}
        />
        <TextField label="מתי" type="date" value={on} onChange={(event) => setOn(event.target.value)} />
        <div className="flex gap-2">
          <Button className="flex-1" onClick={save}>
            שמירה ביומן
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            ביטול
          </Button>
        </div>
      </div>
    )
  }

  if (!visit) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className="mt-4 flex w-full items-center gap-2 rounded-control border border-dashed border-line px-4 py-3 text-sm text-muted transition hover:bg-fg/[0.03]"
      >
        <CircleCheck aria-hidden className="size-4.5 shrink-0" />
        היינו פה? סמנו, דרגו ושמרו ליומן הטיול
      </button>
    )
  }

  return (
    <div className="mt-4 flex items-start gap-3 rounded-control bg-emerald-500/10 px-4 py-3">
      <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          היינו פה · {formatDay(visit.on, { weekday: 'short', day: 'numeric', month: 'short' })}
        </p>
        {visit.rating ? <Stars value={visit.rating} className="mt-1" /> : null}
        {visit.note && <p className="mt-1 text-sm leading-relaxed whitespace-pre-line">{visit.note}</p>}
      </div>
      <button
        type="button"
        aria-label="עריכת הביקור"
        onClick={startEditing}
        className="tap-target relative grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-fg/8"
      >
        <Pencil aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        aria-label="הסרה מהיומן"
        onClick={() => actions.updatePlace(place, { visit: undefined })}
        className="tap-target relative grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-fg/8"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  )
}
