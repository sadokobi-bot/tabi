import { useState, type ReactNode } from 'react'
import { BedDouble, Copy, Pencil, Phone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { actions } from '@/data/actions'
import type { HotelInfo, Place } from '@/data/types'
import { ui } from '@/store/ui'
import { DriverCard } from './DriverCard'

const EMPTY: HotelInfo = {}

/** Check-in / check-out, booking number, phone and the Japanese address of a hotel we stay at. */
export function HotelSection({ place }: { place: Place }) {
  const info = place.hotel ?? EMPTY
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<HotelInfo>(info)
  const [driver, setDriver] = useState(false)
  const hasInfo = Object.values(info).some(Boolean)

  const set = (patch: Partial<HotelInfo>) => setDraft((current) => ({ ...current, ...patch }))

  const save = () => {
    const cleaned = Object.fromEntries(
      Object.entries(draft).flatMap(([key, value]) => (typeof value === 'string' && value.trim() ? [[key, value.trim()]] : [])),
    ) as HotelInfo
    actions.updatePlace(place, { hotel: Object.keys(cleaned).length ? cleaned : undefined }, 'פרטי המלון נשמרו')
    setEditing(false)
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(info.code ?? '')
      ui.toast('קוד ההזמנה הועתק')
    } catch {
      ui.toast('לא הצלחנו להעתיק', 'error')
    }
  }

  const driverCard = <DriverCard place={place} open={driver} onClose={() => setDriver(false)} />

  if (editing) {
    return (
      <div className="surface mt-4 space-y-3 rounded-control p-4">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <BedDouble aria-hidden className="size-4.5 text-accent" />
          פרטי המלון
        </p>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="צ׳ק־אין מ־" type="time" value={draft.checkIn ?? ''} onChange={(e) => set({ checkIn: e.target.value })} />
          <TextField label="צ׳ק־אאוט עד" type="time" value={draft.checkOut ?? ''} onChange={(e) => set({ checkOut: e.target.value })} />
        </div>
        <TextField label="מספר הזמנה" value={draft.code ?? ''} onChange={(e) => set({ code: e.target.value })} dir="ltr" maxLength={60} />
        <TextField
          label="טלפון המלון"
          type="tel"
          value={draft.phone ?? ''}
          onChange={(e) => set({ phone: e.target.value })}
          dir="ltr"
          maxLength={30}
        />
        <TextField
          label="כתובת ביפנית (לא חובה)"
          value={draft.addressJa ?? ''}
          onChange={(e) => set({ addressJa: e.target.value })}
          dir="auto"
          maxLength={200}
          hint="אפשר להעתיק מאישור ההזמנה. בלי זה נציג לנהג את הכתובת מגוגל"
        />
        <div className="flex gap-2">
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

  const startEditing = () => {
    setDraft(info)
    setEditing(true)
  }

  return (
    <div className="surface mt-4 rounded-control p-4">
      <div className="flex items-center gap-2">
        <BedDouble aria-hidden className="size-4.5 text-accent" />
        <p className="flex-1 text-sm font-semibold">פרטי המלון</p>
        {hasInfo && (
          <button
            type="button"
            aria-label="עריכת פרטי המלון"
            onClick={startEditing}
            className="tap-target relative grid size-8 place-items-center rounded-full text-muted hover:bg-fg/8"
          >
            <Pencil aria-hidden className="size-4" />
          </button>
        )}
      </div>

      {hasInfo ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {info.checkIn && <Fact label="צ׳ק־אין">מ־{info.checkIn}</Fact>}
          {info.checkOut && <Fact label="צ׳ק־אאוט">עד {info.checkOut}</Fact>}
          {info.code && (
            <Fact label="מספר הזמנה">
              <button type="button" onClick={copyCode} className="inline-flex items-center gap-1.5 font-semibold" dir="ltr">
                {info.code}
                <Copy aria-label="העתקה" className="size-3.5 text-muted" />
              </button>
            </Fact>
          )}
          {info.phone && (
            <Fact label="טלפון">
              <a href={`tel:${info.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 text-accent" dir="ltr">
                <Phone aria-hidden className="size-3.5" />
                {info.phone}
              </a>
            </Fact>
          )}
        </dl>
      ) : (
        <button type="button" onClick={startEditing} className="mt-2 text-start text-sm text-muted">
          הוסיפו שעות צ׳ק־אין ויציאה, מספר הזמנה וכתובת ביפנית. <span className="font-semibold text-accent">הוספה</span>
        </button>
      )}

      <Button variant="secondary" className="mt-3 w-full" onClick={() => setDriver(true)}>
        להראות לנהג המונית (ביפנית)
      </Button>
      {driverCard}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-medium">{children}</dd>
    </div>
  )
}
