import { useState, type FormEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { Sparkles, Check, Cloud, Copy, HardDrive, Lock, LogOut, Map as MapIcon, Pencil, Plus, Share2, X } from 'lucide-react'
import { displayName, errorMessage, firstName } from '@/backend'
import { Avatar } from '@/components/ui/Avatar'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { actions } from '@/data/actions'
import { getBackend, useCurrentUser, useSession } from '@/store/session'
import { rememberActiveTrip, useTrip, useTripStore } from '@/store/trip'
import { ui, useUi } from '@/store/ui'
import { byGender } from '@/lib/hebrew'
import { FlightsEditor } from './FlightsEditor'
import { JoinRequests } from './JoinRequests'
import { DeleteTrip } from './DeleteTrip'
import { LeaveTrip } from './LeaveTrip'
import { AccountSection } from './AccountSection'
import { startTour } from '@/store/tour'
import { ProfileFields, validateProfile, type ProfileDraft, type ProfileErrors } from './ProfileFields'

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

  const isOwner = trip.ownerId === user.uid
  const ownerName = trip.members[trip.ownerId]?.name ?? 'מי שיצר את הטיול'
  const ownerGender = trip.members[trip.ownerId]?.gender
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({ firstName: '', lastName: '', gender: null })
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({})
  const [removing, setRemoving] = useState<string | null>(null)

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

  const startEditingProfile = () => {
    setProfileDraft({
      firstName: user.profile?.firstName ?? '',
      lastName: user.profile?.lastName ?? '',
      gender: user.profile?.gender ?? null,
    })
    setProfileErrors({})
    setEditingProfile(true)
  }

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    const errors = validateProfile(profileDraft)
    setProfileErrors(errors)
    if (Object.keys(errors).length) return
    try {
      await getBackend().saveProfile(
        user,
        { firstName: profileDraft.firstName.trim(), lastName: profileDraft.lastName.trim(), gender: profileDraft.gender! },
        trips.map((t) => t.id),
      )
      setEditingProfile(false)
      ui.toast('הפרטים נשמרו')
    } catch (error) {
      ui.toast(errorMessage(error), 'error')
    }
  }

  const removeMember = async (uid: string) => {
    try {
      await getBackend().removeMember(trip.id, uid)
      ui.toast(`${trip.members[uid]?.name ?? 'השותף'} הוסר מהטיול`)
    } catch (error) {
      ui.toast(errorMessage(error), 'error')
    } finally {
      setRemoving(null)
    }
  }

  const saveTrip = (event: FormEvent) => {
    event.preventDefault()
    const dayCount = Number(days)
    if (!name.trim() || !startDate || !Number.isInteger(dayCount) || dayCount < 1 || dayCount > 90) {
      ui.toast('בדקו את שם הטיול, התאריך ומספר הימים (1-90)', 'error')
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
      <div className="surface flex items-center gap-3 rounded-card p-4">
        <Avatar name={firstName(user)} className="size-12 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-lg font-bold">
            <span className="truncate">{displayName(user)}</span>
            <button
              type="button"
              aria-label="עריכת הפרטים האישיים"
              onClick={startEditingProfile}
              className="tap-target relative grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-fg/8"
            >
              <Pencil aria-hidden className="size-3.5" />
            </button>
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span dir="ltr">@{user.username}</span>
            <span aria-hidden>·</span>
            {mode === 'cloud' ? <Cloud aria-hidden className="size-3.5" /> : <HardDrive aria-hidden className="size-3.5" />}
            {mode === 'cloud' ? 'מסונכרן בענן' : 'נשמר בדפדפן הזה בלבד'}
          </p>
        </div>
        <Button variant="secondary" icon={<LogOut aria-hidden className="size-4" />} onClick={() => void getBackend().signOut()}>
          יציאה
        </Button>
      </div>

      {editingProfile && (
        <form onSubmit={(event) => void saveProfile(event)} noValidate className="surface mt-4 space-y-4 rounded-card p-4">
          <ProfileFields
            draft={profileDraft}
            errors={profileErrors}
            onChange={(patch) => setProfileDraft((current) => ({ ...current, ...patch }))}
          />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              שמירת הפרטים
            </Button>
            <Button variant="ghost" onClick={() => setEditingProfile(false)}>
              ביטול
            </Button>
          </div>
        </form>
      )}

      {isOwner && (
        <div className="mt-6">
          <JoinRequests />
        </div>
      )}

      <Section title="שותפים לטיול">
        <div className="surface rounded-card p-4">
          <p className="text-sm text-muted">
            {isOwner
              ? 'שתפו את קוד ההזמנה עם מי שמטייל איתכם. כל בקשה להצטרף תגיע אליכם לאישור:'
              : `שתפו את קוד ההזמנה עם מי שמטייל איתכם. ${ownerName} ${byGender(ownerGender, { male: 'מאשר', female: 'מאשרת' })} כל בקשה להצטרף:`}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code
              dir="ltr"
              className="flex-1 rounded-control bg-fg/6 py-3 text-center font-mono text-xl font-bold tracking-[0.3em] select-all"
            >
              {trip.inviteCode}
            </code>
            <button
              type="button"
              aria-label="העתקת הקוד"
              onClick={copyCode}
              className="grid size-12 place-items-center rounded-control bg-fg/6 transition active:scale-90"
            >
              {copied ? <Check aria-hidden className="size-5 text-green-600" /> : <Copy aria-hidden className="size-5" />}
            </button>
            <button
              type="button"
              aria-label="שיתוף"
              onClick={share}
              className="grid size-12 place-items-center rounded-control bg-accent-fill text-accent-fg transition active:scale-90"
            >
              <Share2 aria-hidden className="size-5" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {trip.memberIds.map((uid) => (
              <span key={uid} className="inline-flex items-center gap-1.5 rounded-full bg-fg/5 py-1 ps-1 pe-3 text-xs font-medium">
                <Avatar name={trip.members[uid]?.name ?? '?'} className="size-6 text-[11px]" />
                {trip.members[uid]?.name ?? 'משתתף'}
                {uid === trip.ownerId && <span className="text-muted">· יוצר הטיול</span>}
                {isOwner &&
                  uid !== trip.ownerId &&
                  (removing === uid ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void removeMember(uid)}
                        className="ms-1 font-semibold text-red-600 dark:text-red-400"
                      >
                        להסיר?
                      </button>
                      <button type="button" onClick={() => setRemoving(null)} className="text-muted">
                        לא
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      aria-label={`הסרת ${trip.members[uid]?.name ?? 'השותף'} מהטיול`}
                      onClick={() => setRemoving(uid)}
                      className="tap-target relative -me-1.5 grid size-5 place-items-center rounded-full text-muted hover:bg-fg/10 hover:text-fg"
                    >
                      <X aria-hidden className="size-3" />
                    </button>
                  ))}
              </span>
            ))}
          </div>
          {mode === 'local' && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              כרגע הנתונים נשמרים רק בדפדפן הזה. כדי לערוך יחד מכמה טלפונים צריך לחבר את האפליקציה ל-Firebase (חינמי). ההוראות בקובץ
              docs/SETUP.md.
            </p>
          )}
        </div>
      </Section>

      <div className="mt-6 rounded-card border border-line p-4 [&>section:first-child]:mt-0">
        <Section title="טיסות">
          <FlightsEditor flights={trip.flights} />
        </Section>

        <Section title="פרטי הטיול">
          {!isOwner ? (
            <div className="surface rounded-card p-4 text-sm">
              <p className="font-semibold">{trip.name}</p>
              <p className="mt-0.5 text-muted">
                {trip.days} ימים, מ-{trip.startDate.split('-').reverse().join('.')}
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                <Lock aria-hidden className="size-3.5" />
                רק {ownerName} {byGender(ownerGender, { male: 'יכול', female: 'יכולה' })} לשנות את שם הטיול ואת התאריכים
              </p>
            </div>
          ) : (
            <form onSubmit={saveTrip} className="surface space-y-3 rounded-card p-4" noValidate>
              <TextField label="שם הטיול" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <TextField label="יום ראשון ביפן" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                <TextField
                  label="ימים"
                  type="number"
                  min={1}
                  max={90}
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  dir="ltr"
                />
              </div>
              <Button type="submit" variant="secondary" className="w-full">
                שמירת פרטי הטיול
              </Button>
            </form>
          )}
          <LeaveTrip key={`leave-${trip.id}`} trip={trip} uid={user.uid} onLeft={onClose} />
        </Section>
      </div>
      {isOwner && <DeleteTrip key={trip.id} trip={trip} onDeleted={onClose} />}

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

      <Section title="עזרה">
        <Button
          variant="secondary"
          className="w-full"
          icon={<Sparkles aria-hidden className="size-4" />}
          onClick={() => {
            onClose()
            startTour()
          }}
        >
          סיור קצר באפליקציה
        </Button>
        <Button
          variant="secondary"
          className="mt-2 w-full"
          icon={<MapIcon aria-hidden className="size-4" />}
          onClick={() => {
            onClose()
            startTour('map')
          }}
        >
          סיור במפה
        </Button>
      </Section>

      <Section title="החשבון שלי">
        <AccountSection user={user} cloud={mode === 'cloud'} />
      </Section>
    </div>
  )
}
