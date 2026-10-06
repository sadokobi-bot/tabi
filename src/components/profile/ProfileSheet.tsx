import { useState, type FormEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { Check, Cloud, Copy, HardDrive, LogOut, Map as MapIcon, Plus, Share2 } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { hasGoogleMaps } from '@/config/env'
import { actions } from '@/data/actions'
import { getBackend, useCurrentUser, useSession } from '@/store/session'
import { rememberActiveTrip, useTrip, useTripStore } from '@/store/trip'
import { ui, useUi } from '@/store/ui'
import { FlightsEditor } from './FlightsEditor'

/** Profile & trip settings: invite partners, flights, trip dates, switch trips, sign out. */
export function ProfileSheet() {
  const open = useUi((state) => state.profileOpen)
  const close = () => ui.setProfileOpen(false)
  return (
    <BottomSheet open={open} onClose={close} label="פרופיל והגדרות הטיול">
      <ProfileBody onClose={close} />
    </BottomSheet>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2.5 text-xs font-bold tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  )
}

function ProfileBody({ onClose }: { onClose: () => void }) {
  const user = useCurrentUser()
  const trip = useTrip()
  const trips = useTripStore((state) => state.trips)
  const mode = useSession((state) => state.backend?.mode)
  const [copied, setCopied] = useState(false)

  const [name, setName] = useState(trip.name)
  const [startDate, setStartDate] = useState(trip.startDate)
  const [days, setDays] = useState(String(trip.days))

  const inviteText = `הצטרפו לטיול "${trip.name}" באפליקציית Tabi!\nקוד הזמנה: ${trip.inviteCode}\n${window.location.origin}${import.meta.env.BASE_URL}`

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(trip.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      ui.toast('לא הצלחנו להעתיק. סמנו את הקוד והעתיקו ידנית', 'error')
    }
  }

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tabi', text: inviteText })
      } catch {
        // user cancelled the share sheet
      }
    } else {
      await copyCode()
    }
  }

  const saveTrip = (event: FormEvent) => {
    event.preventDefault()
    const dayCount = Number(days)
    if (!name.trim() || !startDate || !Number.isInteger(dayCount) || dayCount < 1 || dayCount > 90) {
      ui.toast('בדקו את שם הטיול, התאריך ומספר הימים (1–90)', 'error')
      return
    }
    actions.updateTrip({ name: name.trim(), startDate, days: dayCount }, 'פרטי הטיול עודכנו')
  }

  const switchTrip = (tripId: string) => {
    rememberActiveTrip(user.uid, tripId)
    useTripStore.setState({ activeTripId: tripId })
    onClose()
  }

  return (
    <div className="px-5 pt-1 pb-4">
      <div className="flex items-center gap-3">
        <Avatar name={user.username} className="size-12 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{user.username}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            {mode === 'cloud' ? <Cloud aria-hidden className="size-3.5" /> : <HardDrive aria-hidden className="size-3.5" />}
            {mode === 'cloud' ? 'מסונכרן בענן' : 'נשמר בדפדפן הזה בלבד'}
          </p>
        </div>
        <Button variant="secondary" icon={<LogOut aria-hidden className="size-4" />} onClick={() => void getBackend().signOut()}>
          יציאה
        </Button>
      </div>

      <Section title="שותפים לטיול">
        <div className="surface rounded-card p-4">
          <p className="text-sm text-muted">שתפו את קוד ההזמנה כדי שבן/בת הזוג יצטרפו ויערכו יחד:</p>
          <div className="mt-3 flex items-center gap-2">
            <code dir="ltr" className="flex-1 rounded-control bg-fg/6 py-3 text-center font-mono text-xl font-bold tracking-[0.3em] select-all">
              {trip.inviteCode}
            </code>
            <button type="button" aria-label="העתקת הקוד" onClick={copyCode} className="grid size-12 place-items-center rounded-control bg-fg/6 transition active:scale-90">
              {copied ? <Check aria-hidden className="size-5 text-green-600" /> : <Copy aria-hidden className="size-5" />}
            </button>
            <button type="button" aria-label="שיתוף" onClick={share} className="grid size-12 place-items-center rounded-control bg-accent text-accent-fg transition active:scale-90">
              <Share2 aria-hidden className="size-5" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {trip.memberIds.map((uid) => (
              <span key={uid} className="inline-flex items-center gap-1.5 rounded-full bg-fg/5 py-1 ps-1 pe-3 text-xs font-medium">
                <Avatar name={trip.members[uid]?.name ?? '?'} className="size-6 text-[11px]" />
                {trip.members[uid]?.name ?? 'משתתף'}
                {uid === trip.ownerId && <span className="text-muted">· יוצר הטיול</span>}
              </span>
            ))}
          </div>
          {mode === 'local' && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              כרגע הנתונים נשמרים רק בדפדפן הזה. כדי לערוך יחד מכמה טלפונים צריך לחבר את האפליקציה ל-Firebase (חינמי). ההוראות בקובץ docs/SETUP.md.
            </p>
          )}
        </div>
      </Section>

      <Section title="טיסות">
        <FlightsEditor flights={trip.flights} />
      </Section>

      <Section title="פרטי הטיול">
        <form onSubmit={saveTrip} className="space-y-3" noValidate>
          <TextField label="שם הטיול" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <TextField label="יום ראשון ביפן" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} dir="ltr" />
            <TextField label="ימים" type="number" min={1} max={90} value={days} onChange={(event) => setDays(event.target.value)} dir="ltr" />
          </div>
          <Button type="submit" variant="secondary" className="w-full">
            שמירת פרטי הטיול
          </Button>
        </form>
      </Section>

      <Section title="הטיולים שלי">
        <div className="space-y-2">
          {trips.map((other) => (
            <button
              key={other.id}
              type="button"
              onClick={() => switchTrip(other.id)}
              className={clsx(
                'flex w-full items-center justify-between rounded-control border px-4 py-3 text-start text-sm transition',
                other.id === trip.id ? 'border-accent/50 bg-accent/8 font-semibold' : 'border-line hover:bg-fg/5',
              )}
            >
              {other.name}
              {other.id === trip.id && <Check aria-hidden className="size-4 text-accent" />}
            </button>
          ))}
          <Button
            variant="ghost"
            className="w-full"
            icon={<Plus aria-hidden className="size-4" />}
            onClick={() => {
              onClose()
              useTripStore.setState({ creatingTrip: true })
            }}
          >
            טיול חדש או הצטרפות עם קוד
          </Button>
        </div>
      </Section>

      <Section title="חיבורים">
        <ul className="surface divide-y divide-line rounded-card text-sm">
          <li className="flex items-center gap-3 px-4 py-3">
            <MapIcon aria-hidden className="size-4.5 text-muted" />
            <span className="flex-1">מפה וחיפוש</span>
            <span className="font-medium">{hasGoogleMaps ? 'Google Maps' : 'OpenStreetMap (חינמי)'}</span>
          </li>
          <li className="flex items-center gap-3 px-4 py-3">
            <Cloud aria-hidden className="size-4.5 text-muted" />
            <span className="flex-1">חשבונות וסנכרון</span>
            <span className="font-medium">{mode === 'cloud' ? 'Firebase' : 'מקומי'}</span>
          </li>
        </ul>
      </Section>
    </div>
  )
}
