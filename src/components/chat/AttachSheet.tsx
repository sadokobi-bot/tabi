import { useMemo, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { BarChart3, ChevronRight, LocateFixed, MapPin, MapPinned, Plus, Search, X } from 'lucide-react'
import { firstName } from '@/backend'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { CategoryIcon } from '@/components/ui/CategoryIcon'
import { TextField } from '@/components/ui/TextField'
import { sendChatMessage, sharedPlaceOf } from '@/data/chat'
import type { LatLng, MeetPoint, Place } from '@/data/types'
import { addDays, isoDateInTz, minutesInTz } from '@/lib/dates'
import { useCurrentUser } from '@/store/session'
import { useTripStore } from '@/store/trip'
import { ui } from '@/store/ui'

type Step = 'menu' | 'place' | 'meet' | 'poll'

/** The "+" next to the message box: share a place, set a meeting point, or ask the group. */
export function AttachSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} label="שיתוף בצ׳אט">
      {open && <AttachBody onClose={onClose} />}
    </BottomSheet>
  )
}

function AttachBody({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('menu')

  if (step === 'menu')
    return (
      <div className="px-5 pb-5">
        <h2 className="text-lg font-bold tracking-tight">שיתוף בצ׳אט</h2>
        <div className="mt-4 space-y-2">
          <MenuRow
            icon={<MapPin className="size-5" />}
            tint="bg-accent/12 text-accent"
            title="מקום"
            subtitle="מהמקומות ששמרתם, עם כפתור לפתוח אותו"
            onClick={() => setStep('place')}
          />
          <MenuRow
            icon={<MapPinned className="size-5" />}
            tint="bg-emerald-500/14 text-emerald-600 dark:text-emerald-400"
            title="נקודת מפגש"
            subtitle="איפה ומתי נפגשים. נעוץ בראש הצ׳אט עד השעה"
            onClick={() => setStep('meet')}
          />
          <MenuRow
            icon={<BarChart3 className="size-5" />}
            tint="bg-violet-500/14 text-violet-600 dark:text-violet-400"
            title="סקר"
            subtitle="למשל: איפה אוכלים הערב? כל אחד מצביע"
            onClick={() => setStep('poll')}
          />
        </div>
      </div>
    )

  return (
    <div className="px-5 pb-5">
      <button type="button" onClick={() => setStep('menu')} className="-ms-1 mb-2 flex items-center gap-1 text-sm font-medium text-muted">
        <ChevronRight aria-hidden className="size-4" />
        חזרה
      </button>
      {step === 'place' && (
        <>
          <h2 className="text-lg font-bold tracking-tight">איזה מקום לשתף?</h2>
          <PlacePicker
            onPick={(place) => {
              ui.setChatDraft(sharedPlaceOf(place))
              onClose()
            }}
          />
        </>
      )}
      {step === 'meet' && <MeetForm onDone={onClose} />}
      {step === 'poll' && <PollForm onDone={onClose} />}
    </div>
  )
}

function MenuRow({
  icon,
  tint,
  title,
  subtitle,
  onClick,
}: {
  icon: ReactNode
  tint: string
  title: string
  subtitle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface flex w-full items-center gap-3 rounded-control p-3 text-start transition active:scale-[0.98]"
    >
      <span aria-hidden className={clsx('grid size-11 shrink-0 place-items-center rounded-control', tint)}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-muted">{subtitle}</span>
      </span>
    </button>
  )
}

/** The trip's saved places, filterable by name (newest first). */
function PlacePicker({ onPick, selectedId }: { onPick: (place: Place) => void; selectedId?: string }) {
  const places = useTripStore((state) => state.places)
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...places].reverse().filter((place) => !q || place.name.toLowerCase().includes(q))
  }, [places, query])

  if (places.length === 0)
    return <p className="mt-4 text-sm text-muted">עדיין אין מקומות שמורים בטיול. שמרו מקום מהמפה ואז אפשר לשתף אותו.</p>

  return (
    <div className="mt-3">
      {places.length > 6 && (
        <TextField
          label="חיפוש"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          leading={<Search aria-hidden className="size-4" />}
          dir={query ? 'auto' : 'rtl'}
        />
      )}
      <ul className="mt-2 max-h-[42dvh] space-y-1.5 overflow-y-auto">
        {shown.map((place) => (
          <li key={place.id}>
            <button
              type="button"
              onClick={() => onPick(place)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-control p-2 text-start transition active:scale-[0.98]',
                selectedId === place.id ? 'bg-accent/12' : 'hover:bg-fg/5',
              )}
            >
              <CategoryIcon category={place.category} className="size-9" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium" dir="auto">
                {place.name}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Half an hour from now, rounded to the next quarter (Japan time). */
function defaultMeetTime(): string {
  const minutes = Math.ceil((minutesInTz(new Date()) + 30) / 15) * 15
  const clamped = Math.min(minutes, 23 * 60 + 45)
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

function MeetForm({ onDone }: { onDone: () => void }) {
  const user = useCurrentUser()
  const [where, setWhere] = useState<{ name: string; location: LatLng; placeId?: string } | null>(null)
  const [locating, setLocating] = useState(false)
  const [time, setTime] = useState(defaultMeetTime)
  const [note, setNote] = useState('')

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      ui.toast('אין גישה למיקום במכשיר הזה', 'error')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        setWhere({ name: `המיקום של ${firstName(user)}`, location: { lat: position.coords.latitude, lng: position.coords.longitude } })
      },
      () => {
        setLocating(false)
        ui.toast('לא הצלחנו לאתר את המיקום. אפשרו גישה למיקום ונסו שוב', 'error')
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    )
  }

  const send = () => {
    if (!where || !/^\d{2}:\d{2}$/.test(time)) return
    // A time that already passed today means tomorrow.
    const today = isoDateInTz(new Date())
    const [h, m] = time.split(':').map(Number)
    const date = h! * 60 + m! < minutesInTz(new Date()) - 30 ? addDays(today, 1) : today
    const meet: MeetPoint = {
      name: where.name.slice(0, 120),
      location: where.location,
      date,
      time,
      ...(where.placeId ? { placeId: where.placeId } : {}),
    }
    sendChatMessage({ kind: 'meet', meet, text: note.trim() })
    onDone()
  }

  return (
    <div>
      <h2 className="text-lg font-bold tracking-tight">נקודת מפגש</h2>
      <p className="mt-3 text-sm font-medium">איפה?</p>
      <button
        type="button"
        onClick={useMyLocation}
        className={clsx(
          'mt-2 flex w-full items-center gap-3 rounded-control p-2.5 text-start text-sm font-medium transition',
          where && !where.placeId ? 'bg-accent/12' : 'bg-fg/5',
        )}
      >
        <LocateFixed aria-hidden className={clsx('size-5 shrink-0 text-accent', locating && 'animate-pulse')} />
        {locating ? 'מאתרים…' : where && !where.placeId ? 'המיקום שלי עכשיו ✓' : 'המיקום שלי עכשיו'}
      </button>
      <p className="mt-3 text-xs text-muted">או מקום שמור:</p>
      <PlacePicker
        selectedId={where?.placeId}
        onPick={(place) => setWhere({ name: place.name, location: place.location, placeId: place.id })}
      />
      <div className="mt-4 grid grid-cols-2 gap-3">
        <TextField label="מתי" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        <TextField
          label="הערה (לא חובה)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="ליד היציאה המזרחית"
          maxLength={200}
          dir={note ? 'auto' : 'rtl'}
        />
      </div>
      <Button size="lg" className="mt-4 w-full" disabled={!where || !time} onClick={send}>
        שליחה לצ׳אט
      </Button>
    </div>
  )
}

const MAX_OPTIONS = 8

function PollForm({ onDone }: { onDone: () => void }) {
  const places = useTripStore((state) => state.places)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<{ label: string; placeId?: string }[]>([{ label: '' }, { label: '' }])
  const filled = options.map((option) => ({ ...option, label: option.label.trim() })).filter((option) => option.label)
  const ready = question.trim() && filled.length >= 2

  const setLabel = (index: number, label: string) => setOptions((current) => current.map((option, i) => (i === index ? { label } : option)))

  const addPlace = (place: Place) => {
    if (options.some((option) => option.placeId === place.id)) return
    setOptions((current) => {
      const empty = current.findIndex((option) => !option.label.trim())
      const entry = { label: place.name.slice(0, 80), placeId: place.id }
      if (empty >= 0) return current.map((option, i) => (i === empty ? entry : option))
      return current.length < MAX_OPTIONS ? [...current, entry] : current
    })
  }

  const send = () => {
    if (!ready) return
    sendChatMessage({ kind: 'poll', poll: { question: question.trim().slice(0, 200), options: filled.slice(0, MAX_OPTIONS) }, text: '' })
    onDone()
  }

  return (
    <div>
      <h2 className="text-lg font-bold tracking-tight">סקר</h2>
      <div className="mt-3 space-y-3">
        <TextField
          label="השאלה"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="איפה אוכלים הערב?"
          maxLength={200}
          dir={question ? 'auto' : 'rtl'}
        />
        {options.map((option, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField
                label={`אפשרות ${index + 1}`}
                value={option.label}
                onChange={(event) => setLabel(index, event.target.value)}
                maxLength={80}
                dir={option.label ? 'auto' : 'rtl'}
                leading={option.placeId ? <MapPin aria-hidden className="size-4 text-accent" /> : undefined}
              />
            </div>
            {options.length > 2 && (
              <button
                type="button"
                aria-label={`הסרת אפשרות ${index + 1}`}
                onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}
                className="mb-1.5 grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-fg/8"
              >
                <X aria-hidden className="size-4" />
              </button>
            )}
          </div>
        ))}
        {options.length < MAX_OPTIONS && (
          <button
            type="button"
            onClick={() => setOptions((current) => [...current, { label: '' }])}
            className="flex items-center gap-1.5 text-sm font-semibold text-accent"
          >
            <Plus aria-hidden className="size-4" />
            עוד אפשרות
          </button>
        )}
      </div>
      {places.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-muted">להוסיף מהמקומות השמורים:</p>
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
            {[...places].reverse().map((place) => {
              const added = options.some((option) => option.placeId === place.id)
              return (
                <button
                  key={place.id}
                  type="button"
                  disabled={added}
                  onClick={() => addPlace(place)}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-fg/6 px-3 text-sm font-medium disabled:opacity-40"
                >
                  <Plus aria-hidden className="size-3.5" />
                  <span className="max-w-40 truncate" dir="auto">
                    {place.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <Button size="lg" className="mt-4 w-full" disabled={!ready} onClick={send}>
        שליחת הסקר
      </Button>
    </div>
  )
}
