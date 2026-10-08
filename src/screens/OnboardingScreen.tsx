import { useState, type FormEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { ArrowRight, ChevronLeft, LogOut, Sparkles, Users } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { errorMessage } from '@/backend'
import { SakuraDrift } from '@/components/brand/SakuraDrift'
import { SunGate } from '@/components/brand/SunGate'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { isoDateInTz } from '@/lib/dates'
import { normalizeInviteCode } from '@/lib/ids'
import { getBackend, useCurrentUser } from '@/store/session'
import { rememberActiveTrip, useTripStore } from '@/store/trip'

type Step = 'choose' | 'create' | 'join'

const EASE = [0.22, 1, 0.36, 1] as const
const LENGTHS = [7, 14, 21, 30]

/**
 * After sign-up (or "add a trip"): start a trip of your own, or join one with an invite code.
 * A short flow in the sign-in screen's style: choose, then one focused form.
 */
export function OnboardingScreen() {
  const user = useCurrentUser()
  const hasTrips = useTripStore((state) => state.trips.length > 0)
  const [step, setStep] = useState<Step>('choose')

  const [name, setName] = useState(`יפן ${new Date().getFullYear()}`)
  const [startDate, setStartDate] = useState(() => isoDateInTz(new Date()))
  const [days, setDays] = useState('30')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    void run(() => getBackend().createTrip(user, { name: name.trim(), startDate, days: dayCount }))
  }

  const join = (event: FormEvent) => {
    event.preventDefault()
    if (normalizeInviteCode(code).length < 6) {
      setError('הקלידו את קוד ההזמנה שקיבלתם')
      return
    }
    void run(() => getBackend().joinTrip(user, code))
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
                    {hasTrips ? 'טיול נוסף?' : `ברוכים הבאים, ${user.username}!`}
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
                <FormFooter error={error} busy={busy} label="יצירת הטיול" />
              </form>
            )}

            {step === 'join' && (
              <form onSubmit={join} noValidate className="flex flex-1 flex-col">
                <StepHeader
                  icon={<Users className="size-6" />}
                  title="הצטרפות לטיול"
                  text="מקלידים את קוד ההזמנה שקיבלתם, והטיול המשותף נפתח אצלכם"
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
                <FormFooter error={error} busy={busy} label="הצטרפות לטיול" />
              </form>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
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
