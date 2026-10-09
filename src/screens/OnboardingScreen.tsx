import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { ArrowRight, ChevronLeft, Hourglass, LogOut, Sparkles, UserX, Users } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { errorMessage, firstName, type JoinStatus } from '@/backend'
import { SakuraDrift } from '@/components/brand/SakuraDrift'
import { SunGate } from '@/components/brand/SunGate'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useLatest } from '@/hooks/useLatest'
import { hasFirebase } from '@/config/env'
import { ui } from '@/store/ui'
import { isoDateInTz } from '@/lib/dates'
import { seasonFor } from '@/lib/seasons'
import { normalizeInviteCode } from '@/lib/ids'
import { getBackend, useCurrentUser } from '@/store/session'
import { recallPendingJoin, rememberPendingJoin, type PendingJoin } from '@/store/joins'
import { rememberActiveTrip, useTripStore } from '@/store/trip'
import { markTourPending } from '@/store/tour'

type Step = 'choose' | 'create' | 'join' | 'waiting'

const EASE = [0.22, 1, 0.36, 1] as const
const LENGTHS = [7, 14, 21, 30]

/**
 * After sign-up (or "add a trip"): start a trip of your own, or join one with an invite code.
 * A short flow in the sign-in screen's style: choose, then one focused form.
 */
export function OnboardingScreen() {
  const user = useCurrentUser()
  const hasTrips = useTripStore((state) => state.trips.length > 0)
  // A request sent earlier (even before the app was closed) opens straight on the waiting screen.
  const [pending, setPending] = useState<PendingJoin | null>(() => recallPendingJoin(user.uid))
  const [step, setStep] = useState<Step>(() => (recallPendingJoin(user.uid) ? 'waiting' : 'choose'))

  const [name, setName] = useState(`יפן ${new Date().getFullYear()}`)
  const [startDate, setStartDate] = useState(() => isoDateInTz(new Date()))
  const [days, setDays] = useState('30')
  // Cloud mode: offer to have the AI plan every day right after the trip is created.
  const [planWithAi, setPlanWithAi] = useState(hasFirebase)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A new account (no trips yet): the welcome tour waits for its first trip.
  useEffect(() => {
    if (!hasTrips) markTourPending(user.uid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = (next: Step) => {
    setStep(next)
    setError(null)
  }

  const activate = (tripId: string) => {
    rememberActiveTrip(user.uid, tripId)
    useTripStore.setState({ activeTripId: tripId, creatingTrip: false })
  }

  const run = async (task: () => Promise<string>) => {
    setBusy(true)
    setError(null)
    try {
      activate(await task())
    } catch (caught) {
      setError(errorMessage(caught))
      setBusy(false)
    }
  }

  const create = (event: FormEvent) => {
    event.preventDefault()
    const dayCount = Number(days)
    if (!name.trim() || !startDate || !Number.isInteger(dayCount) || dayCount < 1 || dayCount > 90) {
      setError('מלאו שם, תאריך התחלה ומספר ימים (1-90)')
      return
    }
    void run(async () => {
      const id = await getBackend().createTrip(user, { name: name.trim(), startDate, days: dayCount })
      if (planWithAi) ui.setTripWizard(true)
      return id
    })
  }

  const join = async (event: FormEvent) => {
    event.preventDefault()
    if (normalizeInviteCode(code).length < 6) {
      setError('הקלידו את קוד ההזמנה שקיבלתם')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await getBackend().requestJoin(user, code)
      if (result.member) {
        activate(result.tripId)
        return
      }
      const next: PendingJoin = { tripId: result.tripId, tripName: result.tripName, ownerName: result.ownerName }
      rememberPendingJoin(user.uid, next)
      setPending(next)
      setStep('waiting')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  // The request is no longer there and no trip came of it (approved and then removed, or withdrawn
  // elsewhere): back to choosing between joining and a trip of one's own.
  const forgetRequest = () => {
    rememberPendingJoin(user.uid, null)
    setPending(null)
    go('choose')
  }

  const stopWaiting = (cancel: boolean) => {
    if (pending && cancel)
      void getBackend()
        .cancelJoinRequest(pending.tripId, user.uid)
        .catch(() => undefined)
    rememberPendingJoin(user.uid, null)
    setPending(null)
    setCode('')
    go('join')
  }

  return (
    // Scrolls only when the keyboard or a small screen needs it; pinned like the rest of the app.
    <div className="fixed inset-0 overflow-x-hidden overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 size-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent/14 blur-3xl"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <SakuraDrift count={8} />
      </div>
      <div aria-hidden className="status-blend absolute inset-x-0 top-0 h-24" />

      <main className="relative mx-auto flex min-h-full w-full max-w-md flex-col px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        <nav className="flex h-10 items-center justify-between">
          {step !== 'choose' ? (
            <TopButton onClick={() => go('choose')}>
              <ArrowRight aria-hidden className="size-4" /> חזרה
            </TopButton>
          ) : hasTrips ? (
            <TopButton onClick={() => useTripStore.setState({ creatingTrip: false })}>
              <ArrowRight aria-hidden className="size-4" /> חזרה לטיול
            </TopButton>
          ) : (
            <span />
          )}
          <TopButton onClick={() => void getBackend().signOut()}>
            <LogOut aria-hidden className="size-4" /> יציאה
          </TopButton>
        </nav>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: step === 'choose' ? 24 : -24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: step === 'choose' ? -24 : 24 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="flex flex-1 flex-col"
          >
            {step === 'choose' && (
              <>
                <header className="flex flex-1 flex-col items-center justify-center py-8 text-center">
                  <SunGate className="size-20" />
                  <h1 className="mt-5 text-[1.75rem] leading-tight font-bold tracking-tight">
                    {hasTrips ? 'טיול נוסף?' : `ברוכים הבאים, ${firstName(user)}!`}
                  </h1>
                  <p className="mt-2 max-w-xs text-muted">איך מתחילים? אפשר ליצור טיול חדש, או להצטרף לטיול שמישהו כבר פתח.</p>
                </header>
                <div className="space-y-3">
                  <Choice
                    icon={<Sparkles className="size-6" />}
                    title="טיול חדש משלי"
                    text="יוצרים טיול, מתכננים אותו ומזמינים את מי שמטייל איתכם"
                    onClick={() => go('create')}
                  />
                  <Choice
                    icon={<Users className="size-6" />}
                    title="הצטרפות לטיול קיים"
                    text="קיבלתם קוד הזמנה? מצטרפים ומתכננים יחד"
                    onClick={() => go('join')}
                  />
                </div>
              </>
            )}

            {step === 'create' && (
              <form onSubmit={create} noValidate className="flex flex-1 flex-col">
                <StepHeader icon={<Sparkles className="size-6" />} title="טיול חדש" text="כל הפרטים ניתנים לשינוי אחר כך בהגדרות הטיול" />
                <div className="surface space-y-4 rounded-card p-5">
                  <TextField label="שם הטיול" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
                  <TextField label="יום ראשון ביפן" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  <div>
                    <p className="mb-1.5 text-sm font-medium">כמה ימים?</p>
                    <div className="flex items-center gap-2">
                      {LENGTHS.map((length) => (
                        <button
                          key={length}
                          type="button"
                          aria-pressed={days === String(length)}
                          onClick={() => setDays(String(length))}
                          className={clsx(
                            'h-11 flex-1 rounded-control text-sm font-semibold tabular-nums transition',
                            days === String(length) ? 'bg-accent-fill text-accent-fg' : 'bg-fg/6 text-fg hover:bg-fg/10',
                          )}
                        >
                          {length}
                        </button>
                      ))}
                      <input
                        aria-label="מספר ימים אחר"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={90}
                        value={LENGTHS.includes(Number(days)) ? '' : days}
                        placeholder="אחר"
                        onChange={(event) => setDays(event.target.value)}
                        dir="ltr"
                        className="h-11 w-16 shrink-0 appearance-none rounded-control border border-line bg-card/70 text-center text-base tabular-nums outline-none placeholder:text-sm placeholder:text-muted focus:border-accent/60 focus:ring-4 focus:ring-accent/12 [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>
                </div>
                <SeasonHint startDate={startDate} days={Number(days)} />
                {hasFirebase && (
                  <label className="surface mt-3 flex cursor-pointer items-center gap-3 rounded-card p-4">
                    <Sparkles aria-hidden className="size-5 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">לבנות לנו לו״ז לכל הטיול</span>
                      <span className="block text-xs text-muted">כמה שאלות קצרות, וה-AI יתכנן לכם כל יום</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={planWithAi}
                      onChange={(event) => setPlanWithAi(event.target.checked)}
                      className="size-5 shrink-0 accent-[var(--app-accent-fill)]"
                    />
                  </label>
                )}
                <FormFooter error={error} busy={busy} label="יצירת הטיול" />
              </form>
            )}

            {step === 'join' && (
              <form onSubmit={(event) => void join(event)} noValidate className="flex flex-1 flex-col">
                <StepHeader
                  icon={<Users className="size-6" />}
                  title="הצטרפות לטיול"
                  text="מקלידים את קוד ההזמנה שקיבלתם, ומי שיצר את הטיול מאשר את ההצטרפות"
                />
                <div className="surface rounded-card p-5">
                  <TextField
                    label="קוד הזמנה"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    placeholder="K7Q2M9XD"
                    hint="מי שיצר את הטיול מוצא את הקוד בכפתור ״שיתוף״ במסך הטיול"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    autoComplete="off"
                    dir="ltr"
                    className="h-14 text-center font-mono text-xl tracking-[0.3em]"
                    maxLength={12}
                  />
                </div>
                <FormFooter error={error} busy={busy} label="שליחת בקשה להצטרפות" />
              </form>
            )}

            {step === 'waiting' && pending && <Waiting pending={pending} onBack={stopWaiting} onGone={forgetRequest} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

/** What's on in Japan in the chosen dates (blossom, foliage, festivals, holidays). */
function SeasonHint({ startDate, days }: { startDate: string; days: number }) {
  if (!/^d{4}-d{2}-d{2}$/.test(startDate) || !(days >= 1 && days <= 90)) return null
  const events = seasonFor(startDate, days)
  if (events.length === 0) return null
  return (
    <div className="mt-3 rounded-card bg-accent/[0.07] px-4 py-3">
      <p className="text-xs font-semibold text-muted">בתאריכים האלה ביפן</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {events.map((event) => (
          <span key={event.id} className="inline-flex items-center gap-1 rounded-full bg-card/70 px-2.5 py-1 text-xs font-medium">
            <span aria-hidden>{event.emoji}</span>
            {event.title}
          </span>
        ))}
      </div>
    </div>
  )
}

function TopButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap-target relative inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-medium text-muted transition hover:text-fg"
    >
      {children}
    </button>
  )
}

function Choice({ icon, title, text, onClick }: { icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface flex w-full items-center gap-4 rounded-card p-4 text-start transition active:scale-[0.98]"
    >
      <span aria-hidden className="grid size-13 shrink-0 place-items-center rounded-control bg-accent/12 text-accent">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold tracking-tight">{title}</span>
        <span className="mt-0.5 block text-sm leading-snug text-muted">{text}</span>
      </span>
      <ChevronLeft aria-hidden className="size-5 shrink-0 text-muted" />
    </button>
  )
}

function StepHeader({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <header className="py-8">
      <span aria-hidden className="grid size-13 place-items-center rounded-control bg-accent/12 text-accent">
        {icon}
      </span>
      <h1 className="mt-4 text-[1.75rem] leading-tight font-bold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-muted">{text}</p>
    </header>
  )
}

function FormFooter({ error, busy, label }: { error: string | null; busy: boolean; label: string }) {
  return (
    <div className="mt-auto pt-6">
      {error && (
        <p role="alert" className="mb-3 rounded-control bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={busy}>
        {label}
      </Button>
    </div>
  )
}

/**
 * After asking to join: waits for the owner. Approval shows up as the trip itself (the app then
 * opens it, see usePendingJoin in App); a decline or a withdrawn request offers another code.
 */
function Waiting({ pending, onBack, onGone }: { pending: PendingJoin; onBack: (cancel: boolean) => void; onGone: () => void }) {
  const user = useCurrentUser()
  const [status, setStatus] = useState<JoinStatus>({ state: 'pending' })

  useEffect(() => getBackend().watchJoinStatus(pending.tripId, user.uid, setStatus), [pending.tripId, user.uid])

  // No request any more. An approval also deletes it, and the trip may take a moment to arrive (this
  // screen then closes by itself); if it doesn't, the request is simply gone.
  const gone = status.state === 'none'
  const onGoneRef = useLatest(onGone)
  useEffect(() => {
    if (!gone) return
    const timer = setTimeout(() => onGoneRef.current(), 4000)
    return () => clearTimeout(timer)
  }, [gone, onGoneRef])

  const declined = status.state === 'declined'
  const trip = pending.tripName ? `״${pending.tripName}״` : 'הטיול'

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        {declined ? (
          <span aria-hidden className="grid size-20 place-items-center rounded-full bg-fg/6 text-muted">
            <UserX className="size-9" />
          </span>
        ) : (
          <motion.span
            aria-hidden
            className="grid size-20 place-items-center rounded-full bg-accent/12 text-accent"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Hourglass className="size-9" />
          </motion.span>
        )}
        <h1 role="status" className="mt-6 text-[1.75rem] leading-tight font-bold tracking-tight">
          {declined ? 'הבקשה לא אושרה' : 'הבקשה נשלחה'}
        </h1>
        <p className="mt-2 max-w-xs text-muted">
          {declined
            ? `הבקשה להצטרף ל${trip} לא אושרה. אפשר לבדוק את הקוד, או לבקש קוד חדש ממי שיצר את הטיול.`
            : `מחכים לאישור${pending.ownerName ? ` של ${pending.ownerName}` : ''} להצטרפות ל${trip}. ברגע שיאשרו, הטיול ייפתח כאן לבד.`}
        </p>
      </header>
      <div className="mt-auto pt-6">
        {declined ? (
          <Button size="lg" className="w-full" onClick={() => onBack(false)}>
            הקלדת קוד אחר
          </Button>
        ) : (
          <Button size="lg" variant="secondary" className="w-full" onClick={() => onBack(true)}>
            ביטול הבקשה
          </Button>
        )}
      </div>
    </div>
  )
}
