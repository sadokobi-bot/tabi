import { useState, type FormEvent } from 'react'
import { Pencil, Plane, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { actions } from '@/data/actions'
import type { Flight } from '@/data/types'
import { utcToZonedParts, zonedTimeToUtc } from '@/lib/dates'
import { newId } from '@/lib/ids'

const ZONES = [
  { id: 'Asia/Jerusalem', label: 'שעון ישראל' },
  { id: 'Asia/Tokyo', label: 'שעון יפן' },
]

interface Draft {
  id: string
  label: string
  flightNo: string
  from: string
  to: string
  date: string
  time: string
  tz: string
}

function toDraft(flight: Flight): Draft {
  const tz = flight.tz ?? 'Asia/Jerusalem'
  const { date, time } = utcToZonedParts(flight.departAt, tz)
  return { id: flight.id, label: flight.label, flightNo: flight.flightNo ?? '', from: flight.from, to: flight.to, date, time, tz }
}

function emptyDraft(count: number): Draft {
  const outbound = count === 0
  return {
    id: newId(),
    label: outbound ? 'טיסת הלוך' : 'טיסת חזור',
    flightNo: '',
    from: outbound ? 'TLV' : 'NRT',
    to: outbound ? 'NRT' : 'TLV',
    date: '',
    time: '',
    tz: outbound ? 'Asia/Jerusalem' : 'Asia/Tokyo',
  }
}

/** Flights shown in the Today countdown. Departure times are entered in the departure city's time zone. */
export function FlightsEditor({ flights }: { flights: Flight[] }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sorted = [...flights].sort((a, b) => a.departAt.localeCompare(b.departAt))

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (!draft) return
    if (!draft.date || !draft.time || !draft.from.trim() || !draft.to.trim()) {
      setError('מלאו מוצא, יעד, תאריך ושעה')
      return
    }
    const flight: Flight = {
      id: draft.id,
      label: draft.label.trim() || 'טיסה',
      ...(draft.flightNo.trim() ? { flightNo: draft.flightNo.trim().toUpperCase() } : {}),
      from: draft.from.trim().toUpperCase(),
      to: draft.to.trim().toUpperCase(),
      departAt: zonedTimeToUtc(draft.date, draft.time, draft.tz).toISOString(),
      tz: draft.tz,
    }
    actions.updateTrip({ flights: [...flights.filter((f) => f.id !== flight.id), flight] }, 'הטיסה נשמרה')
    setDraft(null)
    setError(null)
  }

  const remove = (id: string) => actions.updateTrip({ flights: flights.filter((f) => f.id !== id) })

  if (draft) {
    const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
    return (
      <form onSubmit={save} className="space-y-3" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="שם" value={draft.label} onChange={(e) => set({ label: e.target.value })} maxLength={30} />
          <TextField
            label="מספר טיסה"
            value={draft.flightNo}
            onChange={(e) => set({ flightNo: e.target.value })}
            dir="ltr"
            placeholder="LY91"
            maxLength={10}
          />
          <TextField label="מוצא" value={draft.from} onChange={(e) => set({ from: e.target.value })} dir="ltr" maxLength={4} />
          <TextField label="יעד" value={draft.to} onChange={(e) => set({ to: e.target.value })} dir="ltr" maxLength={4} />
          <TextField label="תאריך המראה" type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
          <TextField label="שעת המראה" type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} dir="ltr" />
        </div>
        <div className="flex gap-2" role="radiogroup" aria-label="אזור זמן של שעת ההמראה">
          {ZONES.map((zone) => (
            <button
              key={zone.id}
              type="button"
              role="radio"
              aria-checked={draft.tz === zone.id}
              onClick={() => set({ tz: zone.id })}
              className={
                'flex-1 rounded-inner py-2 text-sm font-medium transition ' +
                (draft.tz === zone.id ? 'bg-accent-fill text-accent-fg' : 'bg-fg/6 text-fg')
              }
            >
              {zone.label}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            שמירת הטיסה
          </Button>
          <Button variant="secondary" onClick={() => setDraft(null)}>
            ביטול
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="space-y-2">
      {sorted.map((flight) => (
        <div key={flight.id} className="surface flex items-center gap-3 rounded-control p-3">
          <span className="grid size-10 place-items-center rounded-control bg-accent/12 text-accent">
            <Plane aria-hidden className="size-5 -scale-x-100" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {flight.label}{' '}
              <span dir="ltr" className="font-normal text-muted">
                {flight.from} → {flight.to}
              </span>
            </p>
            <p className="text-xs text-muted">
              {flight.flightNo && `${flight.flightNo} · `}
              {new Intl.DateTimeFormat('he-IL', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: flight.tz ?? 'Asia/Jerusalem',
              }).format(new Date(flight.departAt))}
            </p>
          </div>
          <button
            type="button"
            aria-label="עריכת טיסה"
            onClick={() => setDraft(toDraft(flight))}
            className="tap-target relative grid size-9 place-items-center rounded-full text-muted hover:bg-fg/8"
          >
            <Pencil aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label="מחיקת טיסה"
            onClick={() => remove(flight.id)}
            className="tap-target relative grid size-9 place-items-center rounded-full text-muted hover:bg-red-500/10 hover:text-red-600"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      ))}
      <Button
        variant="secondary"
        className="w-full"
        icon={<Plus aria-hidden className="size-4" />}
        onClick={() => setDraft(emptyDraft(flights.length))}
      >
        הוספת טיסה
      </Button>
    </div>
  )
}
